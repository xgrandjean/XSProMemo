<#
.SYNOPSIS
  Met les fichiers de contenu d'un memoire au format de la page finale : celle du gabarit,
  et le retrait commun a tout contenu de chapitre.

  Pourquoi passer par Word plutot que de retoucher le .docx : le retrait effectif d'un
  paragraphe peut venir du paragraphe, de son style ou d'une liste, et seul Word resout
  cette chaine. C'est le meme calcul qu'a l'assemblage (Set-ContentIndent dans
  BuildMemoire.ps1), applique cette fois au fichier source, une fois pour toutes - apres
  quoi il s'ouvre dans Word tel qu'il apparaitra dans le memoire.

.PARAMETER ManifestPath
  JSON : { shellPath, files: [ { path, level, orientation, label } ] }
  level vaut 0 pour une page de garde, que l'assemblage ne retrait pas.

.NOTES
  stdout : une ligne JSON par evenement. exit 0 = ok, 10 = Word deja ouvert, 1 = erreur.
  Chaque fichier modifie laisse une copie "<nom>.avant-conformite.bak.docx" a cote.
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$ManifestPath
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Write-Json($obj) { Write-Output ($obj | ConvertTo-Json -Compress -Depth 8) }
function Write-ProgressJson([string]$message) { Write-Json (@{ type = "progress"; message = $message }) }

# Tant qu'une reference COM tient, Word ne se ferme pas : il resterait un WINWORD sans
# fenetre, que la generation suivante prendrait pour une session de l'utilisateur.
function Release-Com($obj) {
    if ($null -ne $obj) {
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($obj) | Out-Null } catch {}
    }
}

# Meme regle que l'assemblage : 1 cm pour tout contenu de chapitre, en points.
$RETRAIT_CHAPITRE = 28.35

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

<#
  Deplace le bloc pour poser son paragraphe le moins retrait sur la cible, en preservant
  les ecarts internes - listes imbriquees et citations gardent leur structure. Tableaux et
  images en ligne gardent leur geometrie : retoucher les paragraphes d'un tableau
  retrecirait le texte DANS ses cellules, et une image large deborderait de la marge.
  Renvoie $true si quelque chose a bouge.
#>
function Set-ContentIndent($doc, $cible) {
    $eligibles = @()
    foreach ($paragraph in $doc.Content.Paragraphs) {
        if ($paragraph.Range.Information(12)) { continue }   # wdWithInTable
        if ($paragraph.Range.InlineShapes.Count -gt 0) { continue }
        if ($paragraph.Range.ParagraphFormat.LeftIndent -ge 9999999) { continue }
        $eligibles += $paragraph
    }
    if ($eligibles.Count -eq 0) { return $false }

    $base = ($eligibles | ForEach-Object { $_.Range.ParagraphFormat.LeftIndent } | Measure-Object -Minimum).Minimum
    $decalage = $cible - $base
    if ([Math]::Abs($decalage) -lt 1) { return $false }

    $bouge = $false
    foreach ($paragraph in $eligibles) {
        $nouveau = $paragraph.Range.ParagraphFormat.LeftIndent + $decalage
        if ($nouveau -lt 0 -or $nouveau -gt 1584) { continue }
        $paragraph.Range.ParagraphFormat.LeftIndent = $nouveau
        $bouge = $true
    }
    # La liste tient autant de references COM que de paragraphes : la relacher ici evite
    # qu'elles retiennent Word ouvert apres la fermeture du document.
    foreach ($paragraph in $eligibles) { Release-Com $paragraph }
    $eligibles = $null
    return $bouge
}

$word = $null
$notrePid = $null
$previousAllowReadingMode = $null
$conformes = 0
$ajustes = @()
$echecs = @()

try {
    if (-not (Test-Path -LiteralPath $ManifestPath)) { throw "Manifeste introuvable : $ManifestPath" }
    $manifest = Get-Content -Raw -LiteralPath $ManifestPath -Encoding UTF8 | ConvertFrom-Json

    if (-not (Resolve-WordConflict)) {
        [Console]::Error.WriteLine("WORD_ALREADY_RUNNING")
        exit 10
    }

    Write-ProgressJson "Demarrage de Word..."
    # Les WINWORD presents avant : ce qui apparait ensuite est a nous, et a nous seuls de
    # le fermer si Word s'obstine a rester en memoire.
    $avantDemarrage = @(Get-Process -Name WINWORD -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
    $word = New-Object -ComObject Word.Application
    $notrePid = @(Get-Process -Name WINWORD -ErrorAction SilentlyContinue |
        Where-Object { $avantDemarrage -notcontains $_.Id } | ForEach-Object { $_.Id }) | Select-Object -First 1
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.ScreenUpdating = $false
    try {
        $previousAllowReadingMode = $word.Options.AllowReadingMode
        $word.Options.AllowReadingMode = $false
    } catch {}

    # La page de reference, lue une fois sur le gabarit lui-meme.
    $gabarit = $word.Documents.Open([string]$manifest.shellPath, $false, $true, $false)
    $page = @{
        Largeur      = $gabarit.PageSetup.PageWidth
        Hauteur      = $gabarit.PageSetup.PageHeight
        Gauche       = $gabarit.PageSetup.LeftMargin
        Droite       = $gabarit.PageSetup.RightMargin
        Haut         = $gabarit.PageSetup.TopMargin
        Bas          = $gabarit.PageSetup.BottomMargin
        EnTete       = $gabarit.PageSetup.HeaderDistance
        PiedDePage   = $gabarit.PageSetup.FooterDistance
    }
    $gabarit.Close($false)
    Release-Com $gabarit
    $gabarit = $null

    $files = @($manifest.files)
    for ($i = 0; $i -lt $files.Count; $i++) {
        $fichier = $files[$i]
        $libelle = [string]$fichier.label
        Write-ProgressJson "$($i + 1)/$($files.Count) : $libelle"

        if (-not (Test-Path -LiteralPath ([string]$fichier.path))) {
            $echecs += "$libelle : fichier introuvable."
            continue
        }

        $doc = $null
        try {
            $doc = $word.Documents.Open([string]$fichier.path, $false, $false, $false)

            # En paysage, Word fait tourner les marges avec la page : comparer la marge
            # gauche a celle du gabarit conclurait a un changement a chaque passage.
            # On compare donc l'etat de la page avant et apres, tel qu'il ressort.
            $avant = @(
                $doc.PageSetup.LeftMargin, $doc.PageSetup.TopMargin,
                $doc.PageSetup.PageWidth, $doc.PageSetup.PageHeight,
                [double]$doc.PageSetup.Orientation
            )
            foreach ($section in $doc.Sections) {
                $section.PageSetup.PageWidth = $page.Largeur
                $section.PageSetup.PageHeight = $page.Hauteur
                $section.PageSetup.LeftMargin = $page.Gauche
                $section.PageSetup.RightMargin = $page.Droite
                $section.PageSetup.TopMargin = $page.Haut
                $section.PageSetup.BottomMargin = $page.Bas
                $section.PageSetup.HeaderDistance = $page.EnTete
                $section.PageSetup.FooterDistance = $page.PiedDePage
                # En dernier : Word echange largeur et hauteur en basculant l'orientation.
                # Celle du chapitre, pas celle du gabarit - un chapitre en paysage doit se
                # rediger en paysage, comme il sera assemble.
                if ([string]$fichier.orientation -eq "paysage") { $section.PageSetup.Orientation = 1 }
                else { $section.PageSetup.Orientation = 0 }
            }
            $apres = @(
                $doc.PageSetup.LeftMargin, $doc.PageSetup.TopMargin,
                $doc.PageSetup.PageWidth, $doc.PageSetup.PageHeight,
                [double]$doc.PageSetup.Orientation
            )
            $margesBougees = $false
            for ($k = 0; $k -lt $avant.Count; $k++) {
                if ([Math]::Abs($avant[$k] - $apres[$k]) -ge 1) { $margesBougees = $true }
            }

            # Le retrait ne depend pas du niveau : seule une page de garde (0) n'en recoit
            # aucun, comme a l'assemblage.
            $retraitBouge = $false
            if ([int]$fichier.level -gt 0) {
                $retraitBouge = Set-ContentIndent $doc $RETRAIT_CHAPITRE
            }

            if ($margesBougees -or $retraitBouge) {
                # Une copie a cote avant d'enregistrer : c'est le fichier de travail de
                # l'utilisateur, il doit pouvoir revenir en arriere.
                $dossier = [System.IO.Path]::GetDirectoryName([string]$fichier.path)
                $nom = [System.IO.Path]::GetFileNameWithoutExtension([string]$fichier.path)
                $sauvegarde = Join-Path $dossier "$nom.avant-conformite.bak.docx"
                if (-not (Test-Path -LiteralPath $sauvegarde)) {
                    Copy-Item -LiteralPath ([string]$fichier.path) -Destination $sauvegarde -Force
                }
                $doc.Save()
                $ajustes += $libelle
            } else {
                $conformes += 1
            }
            $doc.Close($false)
            Release-Com $doc
            $doc = $null
        } catch {
            if ($null -ne $doc) {
                try { $doc.Close($false) } catch {}
                Release-Com $doc
                $doc = $null
            }
            $echecs += "$libelle : $($_.Exception.Message)"
        }
    }

    Write-Json (@{
        type      = "result"
        status    = "ok"
        ajustes   = @($ajustes)
        conformes = $conformes
        echecs    = @($echecs)
    })
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
} finally {
    # Avant Quit : parcourir des sections et des paragraphes laisse derriere soi quantite
    # de references COM transitoires, et tant qu'il en reste une seule, Word ne se ferme
    # pas. C'est ce qui laissait un WINWORD sans fenetre, que la generation lancee dans la
    # foulee prenait pour une session de l'utilisateur.
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    [System.GC]::Collect()

    if ($null -ne $word) {
        if ($null -ne $previousAllowReadingMode) {
            try { $word.Options.AllowReadingMode = $previousAllowReadingMode } catch {}
        }
        try { $word.Quit(0) } catch {}   # wdDoNotSaveChanges
        Release-Com $word
    }
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()

    # Word met un instant a disparaitre ; s'il s'obstine, on ferme celui qu'on a demarre -
    # lui seul, jamais une fenetre de l'utilisateur. Les documents sont deja enregistres
    # et fermes a ce stade.
    if ($notrePid) {
        for ($i = 0; $i -lt 30; $i++) {
            if (-not (Get-Process -Id $notrePid -ErrorAction SilentlyContinue)) { break }
            Start-Sleep -Milliseconds 100
        }
        $restant = Get-Process -Id $notrePid -ErrorAction SilentlyContinue
        if ($restant) { try { $restant.Kill() } catch {} }
    }
}
