<#
.SYNOPSIS
  Place (ou retire) le logo dans l'en-tete du gabarit.

  Le logo n'est pas stocke a part : il vit dans l'en-tete Word du gabarit, comme dans
  n'importe quel papier a en-tete. L'application se contente de l'y ecrire, pour que
  l'utilisateur n'ait pas a savoir manipuler un en-tete Word.

.PARAMETER TemplatePath  Le gabarit a modifier.
.PARAMETER LogoPath      L'image a placer. Omis ou vide : l'en-tete est vide.
.PARAMETER HeightMm      Hauteur du logo en millimetres.

.NOTES
  stdout : une ligne JSON. exit 0 = ok, 10 = Word deja ouvert, 1 = erreur.
#>
param(
    [Parameter(Mandatory = $true)][string]$TemplatePath,
    [string]$LogoPath = "",
    [double]$HeightMm = 14
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Write-Json($obj) { Write-Output ($obj | ConvertTo-Json -Compress -Depth 6) }

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
    if (-not (Test-Path -LiteralPath $TemplatePath)) { throw "Gabarit introuvable : $TemplatePath" }
    if ($LogoPath -and -not (Test-Path -LiteralPath $LogoPath)) { throw "Image introuvable : $LogoPath" }

    # Word resolves a relative path against its own working directory, not ours.
    $TemplatePath = (Resolve-Path -LiteralPath $TemplatePath).ProviderPath
    if ($LogoPath) { $LogoPath = (Resolve-Path -LiteralPath $LogoPath).ProviderPath }

    if (-not (Resolve-WordConflict)) {
        [Console]::Error.WriteLine("WORD_ALREADY_RUNNING")
        exit 10
    }

    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    . (Join-Path $PSScriptRoot "LogoHeader.ps1")

    $doc = $word.Documents.Open($TemplatePath, $false, $false)

    foreach ($section in $doc.Sections) {
        # Without this the template shows nothing when opened: it is a single page, so
        # Word displays the first-page header, which is not the one carrying the logo.
        $section.PageSetup.DifferentFirstPageHeaderFooter = 0
    }

    $placed = Set-HeaderLogo -TargetDoc $doc -Sections $doc.Sections -LogoPath $LogoPath -HeightMm $HeightMm

    $doc.Save()
    Write-Json (@{ type = "result"; status = "ok"; placed = $placed })
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
    }
    if ($null -ne $word) { try { $word.Quit() } catch {} }
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    [System.GC]::Collect()
}
