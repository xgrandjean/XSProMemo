/** The explanation texts shown behind every "?" in the app, kept in one place. */

export function AppHelp(): JSX.Element {
  return (
    <>
      <p>
        XSProMemo assemble un mémoire technique à partir de morceaux que vous choisissez,
        au lieu de le retailler à la main dans Word à chaque appel d&apos;offres.
      </p>

      <h3>Trois notions, et c&apos;est tout</h3>
      <dl>
        <dt>La présentation</dt>
        <dd>
          Un document Word — le gabarit — qui porte styles, logo en en-tête, pied de page
          et marges. Aucun contenu. Chaque mémoire produit en est une copie. Elle se règle
          dans la Configuration, derrière l&apos;engrenage.
        </dd>

        <dt>Le mémoire exemple</dt>
        <dd>
          Un mémoire complet qui sert de point de départ. Chaque nouveau mémoire en est une
          copie indépendante : vous supprimez ce qui ne s&apos;applique pas, ajoutez ce qui
          manque.
        </dd>

        <dt>Les mémoires</dt>
        <dd>
          Une réponse à un appel d&apos;offres précis. Chacun a son propre plan — modifier
          l&apos;un n&apos;affecte jamais les autres.
        </dd>
      </dl>

      <h3>Le déroulé</h3>
      <ol>
        <li>
          <b>Nouveau mémoire</b> : vous partez de l&apos;exemple, vous le nommez.
        </li>
        <li>
          <b>Vous ajustez le plan</b> : retirer un chapitre, en ajouter, renommer,
          réordonner, rattacher un fichier.
        </li>
        <li>
          <b>Générer</b> : l&apos;application produit le document Word complet et son PDF.
        </li>
      </ol>

      <h3>Ce que l&apos;application fait, et rien d&apos;autre</h3>
      <p>
        Elle ajoute les <b>titres numérotés</b>, le <b>sommaire</b> et la{' '}
        <b>pagination</b>. Le contenu de vos fichiers est inséré tel quel, avec sa mise en
        forme d&apos;origine : ce que vous voyez dans Word est ce qui sera imprimé.
      </p>

      <h3>Deux règles</h3>
      <ul>
        <li>
          Les contenus sont des fichiers <b>Word</b> uniquement — le mémoire est assemblé
          en un seul document Word.
        </li>
        <li>
          Un fichier ne contient <b>que du contenu</b> : pas de titre de chapitre, pas de
          sommaire, pas de numérotation. C&apos;est l&apos;application qui s&apos;en charge.
        </li>
      </ul>

      <h3>Où sont vos fichiers</h3>
      <p>
        Dans <b>Documents\XSProMemo</b> : le gabarit, vos contenus Word et les documents
        générés. La Configuration propose un raccourci pour y accéder.
      </p>
      <p className="muted">
        Ce n&apos;est pas le dossier habituel des données d&apos;application : Word refuse
        d&apos;ouvrir un document rangé sous AppData sur les postes durcis, et toute la
        chaîne repose sur Word.
      </p>

      <h3>Pendant la génération</h3>
      <p>
        Word doit être fermé : l&apos;application le pilote en arrière-plan et ne veut pas
        perturber un document que vous auriez ouvert. Le message vous le dira le cas
        échéant.
      </p>
    </>
  )
}

export function GabaritHelp(): JSX.Element {
  return (
    <>
      <p>
        La présentation est portée par un document Word <b>vide de contenu</b> — le
        gabarit. Il ne contient que :
      </p>
      <ul>
        <li>les styles (à quoi ressemble un « Titre 1 », un « Titre 2 », le texte courant),</li>
        <li>le pied de page et le numéro de page,</li>
        <li>le format et les marges.</li>
      </ul>
      <p>
        À chaque génération, l&apos;application part d&apos;une copie du gabarit et y verse
        les chapitres. C&apos;est donc lui qui donne son allure à tout le document.
      </p>
      <p>
        Le logo n&apos;en fait pas partie : chaque mémoire porte le sien, réglé depuis son
        propre plan. Celui du mémoire exemple, juste en dessous, est celui que reçoivent
        les nouveaux mémoires.
      </p>
      <p>
        Pour le reste — coordonnées en pied de page, couleurs des titres, marges — ouvrez
        le gabarit dans Word. Une modification profite à tous les mémoires suivants.
      </p>
      <p className="muted">
        Le titre du sommaire se règle ici aussi : c&apos;est le texte affiché au-dessus de
        la table des matières.
      </p>
    </>
  )
}

export function LogoHelp(): JSX.Element {
  return (
    <>
      <p>
        Ce logo n&apos;appartient qu&apos;à ce mémoire. Il a été copié depuis l&apos;exemple
        au moment de la création, mais dès cet instant les deux sont indépendants :
        changer l&apos;un ne touche ni l&apos;autre, ni les mémoires voisins.
      </p>
      <p>
        Utile pour un groupement ou un partenaire dont le logo doit figurer sur ce dossier
        précis, sans changer ce que produiront les autres.
      </p>
      <p className="muted">
        Pour changer celui proposé aux futurs mémoires, réglez-le sur l&apos;exemple, dans
        la Configuration.
      </p>
    </>
  )
}

export function ExempleHelp(): JSX.Element {
  return (
    <>
      <p>
        L&apos;exemple est le <b>point de départ de chaque nouveau mémoire</b>. Mettez-y le
        plan que vous réutilisez le plus souvent, avec vos contenus habituels — et son
        logo, celui qui apparaît sur un mémoire tout juste créé.
      </p>
      <p>
        Quand vous créez un mémoire, l&apos;application en fait une copie complète et
        indépendante, logo compris. Modifier ce mémoire ne touche pas à l&apos;exemple, et
        inversement.
      </p>
      <p>
        Mieux vaut un exemple <b>trop fourni que trop pauvre</b> : il est plus rapide de
        supprimer un chapitre inutile que d&apos;aller rechercher un fichier oublié.
      </p>
    </>
  )
}

export function PlanHelp(): JSX.Element {
  return (
    <>
      <p>
        Le plan est la liste des chapitres, dans l&apos;ordre du document final. Un chapitre
        peut porter un contenu, ou n&apos;être qu&apos;un titre qui chapeaute des
        sous-chapitres.
      </p>

      <h3>Sur chaque ligne</h3>
      <ul>
        <li>
          <b>Le numéro</b> (1, 1.1, 2…) est calculé d&apos;après la position et la
          profondeur. Il se met à jour tout seul si vous réordonnez.
        </li>
        <li>
          <b>Le titre</b> se modifie en cliquant dessus. C&apos;est lui qui apparaîtra dans
          le document et dans le sommaire.
        </li>
        <li>
          <b>Le contenu</b> : un fichier Word. <i>Ouvrir</i> le lance dans Word pour le
          retoucher, <i>Remplacer</i> en choisit un autre, <i>Retirer</i> le détache.
        </li>
        <li>
          <b>Nouvelle page</b> force le chapitre à démarrer en haut d&apos;une page. Sans
          cette case, il s&apos;enchaîne à la suite du précédent.
        </li>
        <li>
          <b>Portrait / Paysage</b> choisit l&apos;orientation. Vous pouvez alterner dans un
          même document — utile pour un plan ou un tableau large.
        </li>
        <li>
          <b>+</b> ajoute un sous-chapitre, <b>↑ ↓</b> déplacent, <b>✕</b> supprime.
        </li>
      </ul>

      <h3>Ce que doivent contenir vos fichiers</h3>
      <p>
        <b>Du contenu, et rien d&apos;autre.</b> Pas de titre de chapitre : l&apos;application
        l&apos;ajoute déjà, et il ferait doublon. Pas de sommaire non plus.
      </p>
      <p>
        Un sous-chapitre est un fichier à part entière. Si un de vos documents contient
        plusieurs parties, découpez-le en autant de fichiers et créez les sous-chapitres
        correspondants.
      </p>

      <p className="muted">
        Supprimer un chapitre ne supprime pas le fichier : il reste utilisable dans vos
        autres mémoires.
      </p>
    </>
  )
}

export function CoverHelp(): JSX.Element {
  return (
    <>
      <p>
        Les pages de garde sont placées <b>tout en tête</b>, avant le sommaire. Elles ne
        sont ni numérotées ni listées dans le sommaire, et ne reçoivent pas de titre :
        leur fichier Word est inséré tel quel.
      </p>
      <p>
        Une seule suffit dans la plupart des cas. Ajoutez-en une seconde uniquement
        s&apos;il y a une pièce distincte à mettre devant — une attestation, une page
        d&apos;engagement.
      </p>
      <p>
        Pour changer le nom du chantier ou le maître d&apos;ouvrage, utilisez{' '}
        <i>Ouvrir</i> : le fichier s&apos;ouvre dans Word.
      </p>
      <p className="muted">
        La numérotation des pages démarre après la page de garde : la première page du
        sommaire est la page 1.
      </p>
    </>
  )
}

export function MemoiresHelp(): JSX.Element {
  return (
    <>
      <p>
        Un mémoire est une réponse à un appel d&apos;offres précis : son propre plan, ses
        propres contenus. Les mémoires sont indépendants les uns des autres.
      </p>

      <h3>Les commandes</h3>
      <ul>
        <li>
          <b>Nouveau mémoire</b> : part d&apos;une copie de l&apos;exemple. Vous retirez ce
          qui ne s&apos;applique pas, vous ajoutez ce qui manque.
        </li>
        <li>
          <b>Ouvrir</b> : le plan du mémoire, et le bouton pour le générer.
        </li>
        <li>
          <b>Dupliquer</b> : la meilleure façon de repartir d&apos;un mémoire précédent
          proche du nouveau. La copie est indépendante.
        </li>
        <li>
          <b>Supprimer</b> : efface le plan. Les fichiers de contenu, eux, restent — ils
          servent peut-être à un autre mémoire.
        </li>
      </ul>

      <h3>Générer</h3>
      <p>
        Le bouton <b>Générer</b> se trouve en haut de l&apos;écran d&apos;un mémoire. Une
        fenêtre affiche l&apos;avancement, puis propose d&apos;ouvrir le document Word ou
        le PDF. Word doit être fermé pendant l&apos;opération.
      </p>
      <p>
        Un mémoire déjà généré affiche <b>Ouvrir le dernier PDF</b> : inutile de
        régénérer pour le relire ou le renvoyer.
      </p>

      <p className="muted">
        Les documents produits sont rangés dans Documents\XSProMemo\documents. La
        Configuration propose un raccourci vers ce dossier.
      </p>
    </>
  )
}
