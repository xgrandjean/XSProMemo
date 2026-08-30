<#
.SYNOPSIS
  Assemble le memoire complet dans UN seul document Word, puis l'exporte en PDF.

  Principe : les fichiers de contenu ne portent que du contenu. L'application ajoute les
  titres numerotes, la table des matieres et la pagination ; Word fait la mise en page.
  Les blocs sont inseres avec InsertFile, qui conserve leur mise en forme d'origine :
  l'objectif est d'imprimer ce que l'auteur a redige, pas de le remettre en forme.

.PARAMETER ManifestPath
  JSON : {
    shellPath, outputDocxPath, outputPdfPath, sommaireTitle,
    coverPages: [ chemin .docx ],
    chapters: [ { title, level, orientation, pageBreakBefore, contentPath|null } ]
  }

.NOTES
  stdout : une ligne JSON par evenement. exit 0 = ok, 10 = Word deja ouvert, 1 = erreur.
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$ManifestPath
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Write-Json($obj) { Write-Output ($obj | ConvertTo-Json -Compress -Depth 8) }
function Write-ProgressJson([string]$message) { Write-Json (@{ type = "progress"; message = $message }) }

function Release-Com($obj) {
    if ($null -ne $obj) {
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($obj) | Out-Null } catch {}
    }
}

<#
  COM automation attaches to any running Word, so we must not start while the user has
  one open. A WINWORD.EXE with no window is not a user session but a leftover from an
  earlier run, which would silently hijack ours; it gets cleared. The age check avoids
  racing a Word the user has just launched.
#>
function Resolve-WordConflict {
    $processes = @(Get-Process -Name WINWORD -ErrorAction SilentlyContinue)
    if ($processes.Count -eq 0) { return $true }
    if (@($processes | Where-Object { $_.MainWindowHandle -ne 0 }).Count -gt 0) { return $false }

    foreach ($process in $processes) {
        try {
            if (((Get-Date) - $process.StartTime).TotalSeconds -gt 10) { $process.Kill() }
        } catch {}
    }
    Start-Sleep -Milliseconds 700
    return (@(Get-Process -Name WINWORD -ErrorAction SilentlyContinue).Count -eq 0)
}

$word = $null
$doc = $null
$previousAllowReadingMode = $null
$warnings = @()

try {
    if (-not (Test-Path -LiteralPath $ManifestPath)) { throw "Manifeste introuvable : $ManifestPath" }
    $manifest = Get-Content -Raw -LiteralPath $ManifestPath -Encoding UTF8 | ConvertFrom-Json

    if (-not (Resolve-WordConflict)) {
        [Console]::Error.WriteLine("WORD_ALREADY_RUNNING")
        exit 10
    }

    Write-ProgressJson "Demarrage de Word..."
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.ScreenUpdating = $false

    # Word opens read-only sources in Reading View, where several operations are refused.
    try {
        $previousAllowReadingMode = $word.Options.AllowReadingMode
        $word.Options.AllowReadingMode = $false
    } catch {}

    Copy-Item -Force -LiteralPath $manifest.shellPath -Destination $manifest.outputDocxPath
    $doc = $word.Documents.Open($manifest.outputDocxPath, $false, $false)
    $doc.Activate()

    $selection = $word.Selection

    # Every insertion happens at the very end of the document. Selection is used rather
    # than a detached Range because it reliably follows the content it just inserted.
    function Go-ToEnd {
        $selection.EndKey(6) | Out-Null   # wdStory
    }

    # --- Pages de garde : contenu tel quel, sans titre ni numero ---
    $coverPages = @($manifest.coverPages)
    for ($i = 0; $i -lt $coverPages.Count; $i++) {
        Write-ProgressJson "Page de garde $($i + 1)/$($coverPages.Count)..."
        Go-ToEnd
        if ($i -gt 0) { $selection.InsertBreak(7) }   # wdPageBreak
        $selection.InsertFile([string]$coverPages[$i], "", $false, $false, $false)
    }

    # The body starts its own section so page numbering can restart after the cover.
    if ($coverPages.Count -gt 0) {
        Go-ToEnd
        $selection.InsertBreak(2)   # wdSectionBreakNextPage
    }
    $bodySectionIndex = $doc.Sections.Count

    # --- Sommaire : table des matieres native, remplie une fois tout en place ---
    Write-ProgressJson "Sommaire..."
    Go-ToEnd
    $selection.Style = -1   # wdStyleNormal : le titre ne doit pas se lister lui-meme
    $selection.ParagraphFormat.Alignment = 0
    $selection.Font.Bold = $true
    $selection.Font.Size = 16
    $selection.TypeText([string]$manifest.sommaireTitle)
    $selection.TypeParagraph()
    $selection.Font.Bold = $false
    $selection.Font.Size = 11

    $toc = $doc.TablesOfContents.Add($selection.Range, $true, 1, 4)
    $tocStart = $toc.Range.Start

    Go-ToEnd
    $selection.InsertBreak(7)   # wdPageBreak

    # --- Chapitres ---
    $chapters = @($manifest.chapters)
    $currentOrientation = "portrait"

    for ($i = 0; $i -lt $chapters.Count; $i++) {
        $chapter = $chapters[$i]
        Write-ProgressJson "Chapitre $($i + 1)/$($chapters.Count) : $($chapter.title)"

        Go-ToEnd
        $wanted = [string]$chapter.orientation
        if ($wanted -ne $currentOrientation) {
            # Changing orientation needs its own section; Word cannot mix them otherwise.
            $selection.InsertBreak(2)   # wdSectionBreakNextPage
            Go-ToEnd
            $section = $doc.Sections.Item($doc.Sections.Count)
            if ($wanted -eq "paysage") { $section.PageSetup.Orientation = 1 }
            else { $section.PageSetup.Orientation = 0 }
            $currentOrientation = $wanted
        }
        elseif ($chapter.pageBreakBefore -and $i -gt 0) {
            $selection.InsertBreak(7)   # wdPageBreak
            Go-ToEnd
        }

        $level = [Math]::Min([Math]::Max([int]$chapter.level, 1), 9)
        $selection.Style = (-1 * ($level + 1))   # wdStyleHeading1 = -2 .. Heading9 = -10
        $selection.TypeText([string]$chapter.title)
        $selection.TypeParagraph()
        $selection.Style = -1                     # wdStyleNormal

        if ($chapter.contentPath) {
            Go-ToEnd
            $selection.InsertFile([string]$chapter.contentPath, "", $false, $false, $false)
        }
    }

    # A block that still carries its own table of contents would leave a second, broken
    # listing in the document. Only the one this script created may remain.
    for ($i = $doc.TablesOfContents.Count; $i -ge 1; $i--) {
        $existing = $doc.TablesOfContents.Item($i)
        if ($existing.Range.Start -ne $tocStart) {
            $existing.Delete()
            $warnings += "Une table des matieres presente dans un fichier de contenu a ete retiree."
        }
    }

    # Le gabarit peut demander une premiere page differente : la premiere page de
    # chaque section perdrait alors en-tete et pied de page. Seule la page de garde a
    # une raison de rester nue.
    for ($i = 2; $i -le $doc.Sections.Count; $i++) {
        $doc.Sections.Item($i).PageSetup.DifferentFirstPageHeaderFooter = 0
    }

    # --- Numerotation : elle repart a 1 apres la page de garde ---
    if ($bodySectionIndex -gt 1 -and $doc.Sections.Count -ge $bodySectionIndex) {
        $footer = $doc.Sections.Item($bodySectionIndex).Footers.Item(1)   # wdHeaderFooterPrimary
        $footer.LinkToPrevious = $false
        $footer.PageNumbers.RestartNumberingAtSection = $true
        $footer.PageNumbers.StartingNumber = 1
    }

    Write-ProgressJson "Mise a jour du sommaire..."
    $doc.Repaginate()
    $doc.TablesOfContents.Item(1).Update()

    $doc.Save()

    Write-ProgressJson "Export PDF..."
    $doc.ExportAsFixedFormat(
        $manifest.outputPdfPath, 17, $false, 0, 0, 1, 1, 0, $true, $false, 1, $false, $true, $false
    )

    Write-Json (@{
        type      = "result"
        status    = "ok"
        docxPath  = $manifest.outputDocxPath
        pdfPath   = $manifest.outputPdfPath
        pageCount = $doc.ComputeStatistics(2)   # wdStatisticPages
        warnings  = @($warnings | Select-Object -Unique)
    })
    exit 0
}
catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
finally {
    if ($null -ne $doc) {
        try { $doc.Saved = $true } catch {}
        try { $doc.Close(0) } catch {}
        Release-Com $doc
    }
    if ($null -ne $word) {
        if ($null -ne $previousAllowReadingMode) {
            try { $word.Options.AllowReadingMode = $previousAllowReadingMode } catch {}
        }
        try { $word.Quit() } catch {}
        Release-Com $word
    }
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    [System.GC]::Collect()
}
