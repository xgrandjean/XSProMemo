<#
.SYNOPSIS
  Place, dans l'en-tete par defaut d'un document Word deja ouvert, un logo a droite et/ou
  un second logo a gauche (utile pour un partenaire ou un client). Utilise par
  BuildMemoire.ps1 pour placer les logos propres a chaque memoire genere.
#>

function Set-HeaderLogo {
    param(
        $TargetDoc,
        # The sections to touch. Passing a subset (rather than always $TargetDoc.Sections)
        # is what lets a mémoire's cover pages stay untouched while its body gets the
        # mémoire's own logo.
        $Sections,
        [string]$RightLogoPath,
        [string]$LeftLogoPath,
        [double]$HeightMm = 14
    )

    $pointsPerMm = 72.0 / 25.4
    $placed = $false

    function Place-Picture($TargetRange, [string]$Path, [int]$Alignment) {
        $TargetRange.ParagraphFormat.Alignment = $Alignment
        $shape = $TargetDoc.InlineShapes.AddPicture($Path, $false, $true, $TargetRange)
        $shape.LockAspectRatio = -1   # msoTrue
        $shape.Height = $HeightMm * $pointsPerMm
    }

    foreach ($section in $Sections) {
        for ($i = 1; $i -le 3; $i++) {
            $header = $section.Headers.Item($i)

            # Clear whatever is there before placing anything, so repeated changes never
            # stack pictures, tables or leftover text on top of each other.
            while ($header.Range.InlineShapes.Count -gt 0) { $header.Range.InlineShapes.Item(1).Delete() }
            while ($header.Shapes.Count -gt 0) { $header.Shapes.Item(1).Delete() }
            while ($header.Range.Tables.Count -gt 0) { $header.Range.Tables.Item(1).Delete() }
            $header.Range.Text = ""
            # Clearing the text does not reset paragraph formatting: without this, an
            # alignment set for a previous logo would silently linger, invisible while
            # the header is empty but ready to surprise the next thing placed there.
            $header.Range.ParagraphFormat.Alignment = 0   # wdAlignParagraphLeft

            # Only the primary header carries content; the others stay empty so a
            # "different first page" template does not repeat it oddly.
            if ($i -ne 1) { continue }
            if (-not $RightLogoPath -and -not $LeftLogoPath) { continue }

            if ($RightLogoPath -and $LeftLogoPath) {
                # Cote a cote : un tableau sans bordure, une image alignee dans chaque
                # cellule. Une seule image ne peut pas etre a la fois collee a gauche et
                # a droite sur la meme ligne autrement.
                $table = $TargetDoc.Tables.Add($header.Range, 1, 2)
                $table.Borders.Enable = $false
                $table.PreferredWidthType = 2   # wdPreferredWidthPercent
                $table.PreferredWidth = 100
                $table.Cell(1, 1).VerticalAlignment = 1   # wdCellAlignVerticalCenter
                $table.Cell(1, 2).VerticalAlignment = 1
                Place-Picture $table.Cell(1, 1).Range $LeftLogoPath 0    # wdAlignParagraphLeft
                Place-Picture $table.Cell(1, 2).Range $RightLogoPath 2  # wdAlignParagraphRight
            }
            elseif ($RightLogoPath) {
                Place-Picture $header.Range $RightLogoPath 2
            }
            else {
                Place-Picture $header.Range $LeftLogoPath 0
            }
            $placed = $true
        }
    }

    return $placed
}
