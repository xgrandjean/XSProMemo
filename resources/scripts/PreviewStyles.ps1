<#
.SYNOPSIS
  Genere un document temporaire, separe du gabarit reel, montrant un exemple de chaque
  niveau de titre suivi d'un paragraphe de texte courant — avec les memes marges, en-tete,
  pied de page et styles que le gabarit actuel. Jamais enregistre comme gabarit, jamais
  melange aux vraies donnees : uniquement pour se faire une idee visuelle du rendu.

.PARAMETER ManifestPath
  JSON : { shellPath, outputDocxPath }

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

    . (Join-Path $PSScriptRoot "HeadingStyles.ps1")

    Copy-Item -Force -LiteralPath $manifest.shellPath -Destination $manifest.outputDocxPath
    $doc = $word.Documents.Open($manifest.outputDocxPath, $false, $false)
    $doc.Activate()
    Set-HeadingKeepTogether $doc

    $selection = $word.Selection
    $selection.EndKey(6) | Out-Null   # wdStory

    Write-ProgressJson "Generation de l'apercu..."
    for ($lvl = 1; $lvl -le 6; $lvl++) {
        $selection.Style = (-1 * ($lvl + 1))   # wdStyleHeading1 = -2 .. Heading6 = -7
        Clear-AutoNumbering $selection
        $selection.TypeText("Titre de niveau $lvl")
        $selection.TypeParagraph()
        $selection.Style = -1                  # wdStyleNormal
        $selection.TypeText(
            "Texte courant : voici un exemple de paragraphe de contenu, tel qu'il " +
            "apparaitra dans un memoire genere avec ce gabarit."
        )
        $selection.TypeParagraph()
    }

    $doc.Save()

    Write-Json (@{ type = "result"; status = "ok"; docxPath = $manifest.outputDocxPath })
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
        try { $word.Quit() } catch {}
        Release-Com $word
    }
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    [System.GC]::Collect()
}
