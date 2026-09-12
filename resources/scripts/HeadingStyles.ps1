<#
.SYNOPSIS
  Garantit que les styles de titre d'un document gardent un titre colle a ce qui le suit,
  quel que soit le gabarit (livre avec l'application ou personnalise par l'utilisateur).

  Idempotent : peut etre appele sur n'importe quel document Word deja ouvert, a chaque
  generation, sans dependre du nom local du style (les styles de titre sont adresses par
  leur identifiant Word natif, le meme utilise ailleurs pour appliquer un style de titre :
  -1*(niveau+1) = wdStyleHeading1..9).
#>
function Set-HeadingKeepTogether($TargetDoc) {
    for ($lvl = 1; $lvl -le 9; $lvl++) {
        $headingStyle = $TargetDoc.Styles.Item(-1 * ($lvl + 1))   # wdStyleHeading1..9
        $headingStyle.ParagraphFormat.KeepWithNext = $true        # jamais un titre isole en bas de page
        $headingStyle.ParagraphFormat.KeepTogether = $true        # le titre lui-meme ne se coupe pas
    }
    $TargetDoc.Styles.Item(-1).ParagraphFormat.WidowControl = $true   # wdStyleNormal
}

<#
  L'application tape elle-meme la numerotation du chapitre (ex. "3.4.10.1") en texte
  litteral avant son titre. Si le style de titre du gabarit est lie a une liste a
  plusieurs niveaux (heritee d'un autre document, copiee-collee un jour), Word ajoute
  EN PLUS sa propre numerotation automatique (ex. "A.1.1") juste devant : les deux se
  cumulent. A appliquer juste apres avoir donne a $Selection le style du titre, avant
  d'y taper le texte - un paragraphe sans liste associee n'est pas affecte.
#>
function Clear-AutoNumbering($Selection) {
    $Selection.Range.ListFormat.RemoveNumbers()
}
