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
