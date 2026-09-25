<#
.SYNOPSIS
  Garantit que la cellule portant le numero de page, dans le pied de page, est assez large
  pour l'afficher sur une seule ligne.

  Le pied de page livre est un tableau de trois colonnes en pourcentage : deux filets
  decoratifs de part et d'autre, et au milieu un trou qui porte "Page {PAGE}". Une largeur
  en pourcentage pour un texte de taille fixe est une fausse bonne idee : elargir les marges
  du gabarit retrecit la colonne centrale, et "Page 100" passe a la ligne. Constate sur le
  gabarit livre, ou 2 cm de marges ne laissaient que 1,32 cm de texte au milieu.

  On n'essaie pas de detecter le debordement : Word ne sait pas le dire de facon fiable
  depuis un pied de page (ComputeStatistics y renvoie 0 ligne). On impose une geometrie
  minimale, ce qui est de l'arithmetique sur des largeurs, pas une question de rendu.

  Applique a la copie generee, jamais au gabarit lui-meme, comme Set-HeadingKeepTogether.
#>

function Set-PageNumberCellWidth {
    param(
        $TargetDoc,
        # 2,5 cm : "Page 100" en 11 pt tient avec de la marge, et le filet reste large.
        [double]$MinimumPoints = 71
    )

    foreach ($section in $TargetDoc.Sections) {
        for ($kind = 1; $kind -le 3; $kind++) {
            try {
                $footer = $section.Footers.Item($kind)
                if (-not $footer.Exists) { continue }

                foreach ($field in $footer.Range.Fields) {
                    if ($field.Type -ne 33) { continue }   # wdFieldPage

                    # Le champ n'est pas forcement dans un tableau : un pied de page reduit
                    # a un paragraphe centre n'a aucun probleme de largeur, et rien a regler.
                    $cells = $field.Code.Cells
                    if ($cells.Count -lt 1) { continue }

                    $cell = $cells.Item(1)
                    if ($cell.Width -ge $MinimumPoints) { continue }   # deja assez large

                    # Les voisines cedent la difference, a parts egales : sans cela le
                    # tableau depasserait la marge droite (verifie : +22,8 pt sur le gabarit
                    # livre). La largeur totale de la ligne reste donc inchangee, et le filet
                    # decoratif continue de courir d'une marge a l'autre.
                    $row = $cell.RowIndex
                    $others = @()
                    $total = 0
                    foreach ($c in $cell.Range.Tables.Item(1).Range.Cells) {
                        if ($c.RowIndex -ne $row) { continue }
                        $total += $c.Width
                        if ($c.ColumnIndex -ne $cell.ColumnIndex) { $others += $c }
                    }
                    if ($others.Count -eq 0) { continue }

                    $share = ($total - $MinimumPoints) / $others.Count
                    if ($share -le 0) { continue }   # tableau trop etroit : on ne bricole pas

                    foreach ($c in $others) { $c.Width = $share }
                    $cell.Width = $MinimumPoints
                }
            } catch {
                # Un pied de page qu'on ne sait pas ajuster ne doit jamais faire echouer une
                # generation : le document reste correct, seul le numero peut passer a la ligne.
            }
        }
    }
}
