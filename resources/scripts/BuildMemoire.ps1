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
    . (Join-Path $PSScriptRoot "HeadingStyles.ps1")

    Copy-Item -Force -LiteralPath $manifest.shellPath -Destination $manifest.outputDocxPath
    $doc = $word.Documents.Open($manifest.outputDocxPath, $false, $false)
    $doc.Activate()
    Set-HeadingKeepTogether $doc

    $selection = $word.Selection

    # Every insertion happens at the very end of the document. Selection is used rather
    # than a detached Range because it reliably follows the content it just inserted.
    function Go-ToEnd {
        $selection.EndKey(6) | Out-Null   # wdStory
    }

    <#
      Selection.InsertFile silently drops some floating shapes on the way in — notably a
      text box saved with a VML fallback (mc:AlternateContent), the kind Word itself still
      produces for many "Insert > Text Box" objects. The paragraph survives, empty; the
      shape (e.g. a page de garde's printed company footer) does not, with no warning.
      Opening the source as its own document and transplanting its content through
      Range.FormattedText goes through Word's native copy/paste formatting engine instead
      of InsertFile's merge, which carries every shape across intact. Deliberately not
      clipboard-based (Selection.Paste after Content.Copy): that would depend on whatever
      paste format the user's own Word is configured to default to, and would touch their
      real clipboard during a background export.
    #>
    <#
      Une forme flottante calee a une position horizontale fixe garde ce decalage une fois
      transplantee : il avait ete calcule sur les marges de SON fichier, alors que la page
      finale prend celles du gabarit. Tant que les deux largeurs utiles coincident rien ne
      bouge ; des qu'elles different, l'image se retrouve decentree, et personne ne le voit
      avant l'impression. Ce n'est donc signale que lorsque les deux conditions se cumulent.
    #>
    function Test-PositionFixe($srcDoc) {
        try {
            $largeurSource = $srcDoc.PageSetup.PageWidth - $srcDoc.PageSetup.LeftMargin - $srcDoc.PageSetup.RightMargin
            $largeurCible = $doc.PageSetup.PageWidth - $doc.PageSetup.LeftMargin - $doc.PageSetup.RightMargin
            if ([Math]::Abs($largeurSource - $largeurCible) -lt 2) { return $false }
            foreach ($forme in $srcDoc.Shapes) {
                # wdShapeCenter/Left/Right/Inside/Outside valent -999 a -995 : Word recalcule
                # ces positions a chaque rendu, elles suivent donc les marges reellement
                # appliquees. Toute autre valeur est un decalage fige a l'ecriture.
                if ($forme.Left -le -995) { continue }
                return $true
            }
            return $false
        } catch {
            # Un avertissement ne doit jamais faire echouer une generation.
            return $false
        }
    }

    function Insert-DocumentContent($path) {
        $srcDoc = $word.Documents.Open([string]$path, $false, $true, $false)
        try {
            $script:PositionFixeRisquee = Test-PositionFixe $srcDoc
            $selection.Range.FormattedText = $srcDoc.Content.FormattedText
        } finally {
            $srcDoc.Close($false)   # wdDoNotSaveChanges
        }
    }

    # Une ligne vide en tete ou en fin d'un contenu est une incertitude d'auteur ("faut-il
    # en laisser une avant mon premier paragraphe, sachant qu'un titre va etre ajoute avant
    # ?"), jamais une intention de mise en page : on la retire silencieusement, sans toucher
    # aux paragraphes internes ni au titre lui-meme.
    function Trim-BlankEdges($range) {
        if ($range.Paragraphs.Count -eq 0) { return }
        $first = $range.Paragraphs.Item(1)
        # Range.Delete renvoie le nombre de caracteres supprimes : sans Out-Null, ce
        # nombre part sur stdout au milieu des evenements JSON lus par l'application.
        if (($first.Range.Text -replace "[\r\a\s]", "") -eq "") { $first.Range.Delete() | Out-Null }
        $count = $range.Paragraphs.Count
        if ($count -ge 1) {
            $last = $range.Paragraphs.Item($count)
            if (($last.Range.Text -replace "[\r\a\s]", "") -eq "") { $last.Range.Delete() | Out-Null }
        }
    }

    <#
      Un saut de section apporte avec lui SA mise en page. Transplante depuis un fichier
      de contenu, il impose donc les marges de ce fichier a tout ce qui le precede dans le
      memoire - sommaire compris - alors que la geometrie de la page appartient au seul
      gabarit. Word rattache le texte precedent a la section suivante quand le saut
      disparait : le supprimer rend bien la main au gabarit.
      Renvoie $true si le contenu en portait, pour le signaler a l'utilisateur.
    #>
    function Remove-SautsDeSection($range) {
        try {
            $find = $range.Find
            $find.ClearFormatting()
            $find.Replacement.ClearFormatting()
            $find.Text = "^b"
            # Par une marque de paragraphe, jamais par rien : le saut porte aussi la fin du
            # paragraphe qui le precede, et le remplacer par du vide souderait la derniere
            # phrase d'avant a la premiere phrase d'apres.
            $find.Replacement.Text = "^p"
            $find.Forward = $true
            $find.Wrap = 0            # wdFindStop : ne deborde pas de la plage inseree
            $find.Format = $false
            return [bool]$find.Execute([ref]"^b", [ref]$false, [ref]$false, [ref]$false, [ref]$false,
                [ref]$false, [ref]$true, [ref]0, [ref]$false, [ref]"^p", [ref]2)   # wdReplaceAll
        } catch {
            return $false
        }
    }

    <#
      Pose le contenu d'un chapitre au retrait de son niveau, pour que la hierarchie du
      plan se lise dans la page.

      On DEPLACE le bloc, on ne lui ajoute pas un retrait : beaucoup de fichiers de
      contenu portent deja le leur (celui de "1.1 Une ambition collective" vaut 1 cm), et
      s'ajouter au leur produisait un bloc perdu au milieu de la page. Le decalage se
      calcule sur le paragraphe le moins retrait du bloc, ce qui preserve les retraits
      relatifs a l'interieur - listes imbriquees et citations gardent leur structure - et
      ne touche a rien quand le fichier respecte deja la regle annoncee aux redacteurs.
    #>
    function Set-ContentIndent($range, $cible) {
        if ($cible -le 0 -or $range.Paragraphs.Count -eq 0) { return }

        # Seul le texte courant se deplace. Un tableau garde sa geometrie : retoucher ses
        # paragraphes ne deplacerait pas le tableau mais retrecirait le texte DANS chaque
        # cellule. Une image en ligne garde la sienne aussi : large, elle deborderait de
        # la marge de droite et serait rognee a l'impression.
        $eligibles = @()
        foreach ($paragraph in $range.Paragraphs) {
            if ($paragraph.Range.Information(12)) { continue }   # wdWithInTable
            if ($paragraph.Range.InlineShapes.Count -gt 0) { continue }
            # Word rend 9999999 (wdUndefined) quand le retrait n'est pas determinable.
            if ($paragraph.Range.ParagraphFormat.LeftIndent -ge 9999999) { continue }
            $eligibles += $paragraph
        }
        if ($eligibles.Count -eq 0) { return }

        $base = ($eligibles | ForEach-Object { $_.Range.ParagraphFormat.LeftIndent } | Measure-Object -Minimum).Minimum
        $decalage = $cible - $base
        if ([Math]::Abs($decalage) -lt 1) { return }

        foreach ($paragraph in $eligibles) {
            $nouveau = $paragraph.Range.ParagraphFormat.LeftIndent + $decalage
            # Word refuse toute valeur hors de +/-1584 pt, et un retrait negatif ferait
            # deborder le texte dans la marge.
            if ($nouveau -lt 0 -or $nouveau -gt 1584) { continue }
            $paragraph.Range.ParagraphFormat.LeftIndent = $nouveau
        }
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
        $insertStart = $selection.Range.Start
        Insert-DocumentContent $coverPages[$i]
        if ($script:PositionFixeRisquee) {
            $warnings += "Page de garde $($i + 1) : une image y est placee a une position fixe, calee sur des marges differentes de celles du gabarit. Verifiez son centrage dans le document genere."
        }
        Go-ToEnd
        if (Remove-SautsDeSection ($doc.Range($insertStart, $selection.Range.End))) {
            $warnings += "Page de garde $($i + 1) : un saut de section present dans le fichier a ete retire, il imposait ses propres marges au document."
        }
        Go-ToEnd
        Trim-BlankEdges ($doc.Range($insertStart, $selection.Range.End))
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
        Clear-AutoNumbering $selection

        # L'attribut "saut de page avant" de Word plutot qu'un saut insere en dur : il
        # ne saute que si le titre n'est pas deja en haut d'une page. Un contenu qui se
        # termine par son propre saut ne laisse donc plus de page blanche derriere lui.
        $selection.ParagraphFormat.PageBreakBefore = [bool]$chapter.pageBreakBefore

        $selection.TypeText([string]$chapter.title)
        $selection.TypeParagraph()
        # Un demi-centimetre par niveau, la valeur exacte que la consigne demande aux
        # redacteurs d'appliquer : un fichier conforme traverse l'assemblage sans bouger.
        # Fixe, et non mesure sous le texte du titre, car la largeur d'un numero varie
        # ("1" contre "10", "1.9" contre "1.10") : le bord gauche du texte se serait
        # deplace d'un chapitre a l'autre, a niveau pourtant egal.
        $cibleRetrait = $level * 14.17            # points (0,5 cm)
        $selection.Style = -1                     # wdStyleNormal
        # Le paragraphe suivant herite du reglage : il faut le lever, sinon le contenu
        # partirait lui aussi sur une nouvelle page.
        $selection.ParagraphFormat.PageBreakBefore = $false

        if ($chapter.contentPath) {
            Go-ToEnd
            $insertStart = $selection.Range.Start
            Insert-DocumentContent $chapter.contentPath
            if ($script:PositionFixeRisquee) {
                $warnings += "Chapitre $($chapter.title) : une image y est placee a une position fixe, calee sur des marges differentes de celles du gabarit. Verifiez son centrage dans le document genere."
            }
            Go-ToEnd
            if (Remove-SautsDeSection ($doc.Range($insertStart, $selection.Range.End))) {
                $warnings += "Chapitre $($chapter.title) : un saut de section present dans le fichier a ete retire, il imposait ses propres marges au document."
            }
            Go-ToEnd
            Trim-BlankEdges ($doc.Range($insertStart, $selection.Range.End))
            # Le retrait se calcule sur ce qu'il reste APRES le rognage : un contenu
            # entierement vide n'en laisse rien, et la plage ne delimiterait alors plus
            # le contenu de ce chapitre mais un paragraphe voisin.
            Go-ToEnd
            $contentEnd = $selection.Range.End
            if ($contentEnd -gt $insertStart) {
                Set-ContentIndent ($doc.Range($insertStart, $contentEnd)) $cibleRetrait
            }
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
            # Out-Null comme partout ailleurs : Range.Delete renvoie le nombre de
            # caracteres supprimes, qui sortirait au milieu des evenements JSON.
            $section.Headers.Item(1).Range.Delete() | Out-Null
            $section.Footers.Item(1).Range.Delete() | Out-Null
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

    <#
      Le document Word est enregistre : a partir d'ici, le travail est fait et ne doit plus
      etre perdu. L'export PDF echoue des que le fichier de destination est tenu par un
      lecteur, et c'est la toute derniere ligne de plusieurs minutes d'assemblage — le
      laisser remonter dans le catch global reviendrait a declarer en echec un memoire
      entierement genere. Il devient donc un avertissement, et le resultat porte pdfPath
      a $null pour que l'application n'aille pas proposer le PDF de la fois precedente,
      qui ne correspond plus a ce Word.
    #>
    Write-ProgressJson "Export PDF..."
    $pdfPath = $null
    try {
        $doc.ExportAsFixedFormat(
            $manifest.outputPdfPath, 17, $false, 0, 0, 1, 1, 0, $true, $false, 1, $false, $true, $false
        )
        $pdfPath = $manifest.outputPdfPath
    } catch {
        # Pas de message francais ici : ce fichier est lu en ANSI par PowerShell 5.1 (pas de
        # BOM), les accents y seraient mutiles. L'application compose la phrase, elle sait
        # aussi verifier si le fichier est bien verrouille avant de l'affirmer.
    }

    Write-Json (@{
        type      = "result"
        status    = "ok"
        docxPath  = $manifest.outputDocxPath
        pdfPath   = $pdfPath
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
