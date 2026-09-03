<#
.SYNOPSIS
  Place ou retire une image dans l'en-tete par defaut d'un document Word deja ouvert.

  Utilise par BuildMemoire.ps1 pour placer le logo propre a chaque memoire genere.
#>

function Set-HeaderLogo {
    param(
        $TargetDoc,
        # The sections to touch. Passing a subset (rather than always $TargetDoc.Sections)
        # is what lets a mémoire's cover pages stay untouched while its body gets the
        # mémoire's own logo.
        $Sections,
        [string]$LogoPath,
        [double]$HeightMm = 14
    )

    $pointsPerMm = 72.0 / 25.4
    $placed = $false

    foreach ($section in $Sections) {
        for ($i = 1; $i -le 3; $i++) {
            $header = $section.Headers.Item($i)

            # Clear whatever is there before placing the new logo, so repeated changes
            # never stack images on top of each other.
            while ($header.Range.InlineShapes.Count -gt 0) { $header.Range.InlineShapes.Item(1).Delete() }
            while ($header.Shapes.Count -gt 0) { $header.Shapes.Item(1).Delete() }

            if (-not $LogoPath) { continue }
            # Only the primary header carries the logo; the others stay empty so a
            # "different first page" template does not repeat it oddly.
            if ($i -ne 1) { continue }

            $range = $header.Range
            $range.Text = ""
            $shape = $TargetDoc.InlineShapes.AddPicture($LogoPath, $false, $true, $range)
            $shape.LockAspectRatio = -1   # msoTrue
            $shape.Height = $HeightMm * $pointsPerMm
            $shape.Range.ParagraphFormat.Alignment = 2   # wdAlignParagraphRight
            $placed = $true
        }
    }

    return $placed
}
