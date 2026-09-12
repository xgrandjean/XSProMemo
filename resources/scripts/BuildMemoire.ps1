<#
.SYNOPSIS
  Assemble le memoire complet dans UN seul document Word, puis l'exporte en PDF.

  Principe : les fichiers de contenu ne portent que du contenu. L'application ajoute les
  titres numerotes, la table des matieres et la pagination ; Word fait la mise en page.
  Les blocs sont inseres avec InsertFile, qui conserve leur mise en forme d'origine :
  l'objectif est d'imprimer ce que l'auteur a redige, pas de le remettre en forme.

.PARAMETER ManifestPath
  JSON : {
    shellPath, outputDocxPath, outputPdfPath, sommaireTitle, logoPath|null, secondLogoPath|null,
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

    . (Join-Path $PSScriptRoot "LogoHeader.ps1")

    Copy-Item -Force -LiteralPath $manifest.shellPath -Destination $manifest.outputDocxPath
    $doc = $word.Documents.Open($manifest.outputDocxPath, $false, $false)
    $doc.Activate()

    $selection = $word.Selection

    # Every insertion happens at the very end of the document. Selection is used rather
    # than a detached Range because it reliably follows the content it just inserted.
    function Go-ToEnd {
        $selection.EndKey(6) | Out-Null   # wdStory
    }

    # Le point d'insertion doit etre un paragraphe a lui : sans cela le titre suivant
    # se colle a la derniere ligne du contenu precedent et lui impose son style, ce qui
    # fait remonter des phrases entieres dans le sommaire.
    function Ensure-OwnParagraph {
        Go-ToEnd
        $last = $doc.Paragraphs.Item($doc.Paragraphs.Count)
        $texte = $last.Range.Text -replace "[`r`n`a`f ]", ""
        if ($texte -ne "") {
            $selection.TypeParagraph()
            Go-ToEnd
        }
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
    Ensure-OwnParagraph
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

    # UseHyperlinks de TablesOfContents.Add ne s'applique qu'a une publication web (doc
    # Microsoft) : sans ceci, le champ TOC genere n'a pas le commutateur \h, donc ni le
    # Ctrl+clic dans Word ni le sommaire du PDF exporte ne sont cliquables (seul le panneau
    # de signets, une fonctionnalite PDF distincte basee sur les styles de titre, marche).
    $tocField = $toc.Range.Fields | Where-Object { $_.Type -eq 13 } | Select-Object -First 1   # wdFieldTOC
    if ($tocField -and $tocField.Code.Text -notmatch '\\h(\s|$)') {
        $tocField.Code.Text = $tocField.Code.Text.TrimEnd() + ' \h '
    }

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

        $level = [Math]::Min([Math]::Max([int]$chapter.level, 1), 9)
        Ensure-OwnParagraph
        $selection.Style = (-1 * ($level + 1))   # wdStyleHeading1 = -2 .. Heading9 = -10

        # L'attribut "saut de page avant" de Word plutot qu'un saut insere en dur : il
        # ne saute que si le titre n'est pas deja en haut d'une page. Un contenu qui se
        # termine par son propre saut ne laisse donc plus de page blanche derriere lui.
        $selection.ParagraphFormat.PageBreakBefore = [bool]$chapter.pageBreakBefore

        $selection.TypeText([string]$chapter.title)
        $selection.TypeParagraph()
        $selection.Style = -1                     # wdStyleNormal
        # Le paragraphe suivant herite du reglage : il faut le lever, sinon le contenu
        # partirait lui aussi sur une nouvelle page.
        $selection.ParagraphFormat.PageBreakBefore = $false

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

    # En-tete et pied de page : nus sur la page de garde, presents partout ailleurs.
    # On ne s'en remet pas au reglage "premiere page differente" du gabarit, qui donne
    # un resultat dependant du nombre de pages de la garde.
    for ($i = 1; $i -le $doc.Sections.Count; $i++) {
        $doc.Sections.Item($i).PageSetup.DifferentFirstPageHeaderFooter = 0
    }

    if ($coverPages.Count -gt 0 -and $bodySectionIndex -gt 1) {
        # L'ordre compte : desolidariser le corps d'abord y recopie l'en-tete du gabarit,
        # logo compris. Vider la garde en premier le ferait disparaitre partout.
        for ($i = $bodySectionIndex; $i -le $doc.Sections.Count; $i++) {
            $doc.Sections.Item($i).Headers.Item(1).LinkToPrevious = $false
            $doc.Sections.Item($i).Footers.Item(1).LinkToPrevious = $false
        }
        for ($i = 1; $i -lt $bodySectionIndex; $i++) {
            $section = $doc.Sections.Item($i)
            if ($i -gt 1) {
                # Word refuse cette propriete sur la premiere section : pas de precedente.
                $section.Headers.Item(1).LinkToPrevious = $false
                $section.Footers.Item(1).LinkToPrevious = $false
            }
            $section.Headers.Item(1).Range.Delete()
            $section.Footers.Item(1).Range.Delete()
        }
    }

    # Le logo du memoire, pas celui que porte le gabarit partage a l'instant present :
    # deux memoires ouverts en parallele ne doivent pas se marcher dessus si l'un change
    # de logo pendant que l'autre est en cours. Seul le corps le recoit, jamais la garde.
    $bodySections = @()
    for ($i = $bodySectionIndex; $i -le $doc.Sections.Count; $i++) { $bodySections += $doc.Sections.Item($i) }
    Set-HeaderLogo -TargetDoc $doc -Sections $bodySections `
        -RightLogoPath ([string]$manifest.logoPath) -LeftLogoPath ([string]$manifest.secondLogoPath) | Out-Null

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
