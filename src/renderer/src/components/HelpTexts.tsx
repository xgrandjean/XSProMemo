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

        <dt>Les modèles</dt>
        <dd>
          Un ou plusieurs mémoires complets qui servent de point de départ. Chaque nouveau
          mémoire en est une copie indépendante : vous supprimez ce qui ne s&apos;applique
          pas, ajoutez ce qui manque.
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
          <b>Nouveau mémoire</b> : vous partez d&apos;un modèle, vous le nommez.
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
        Par défaut dans <b>Documents\XSProMemo</b> : le gabarit, vos contenus Word et les
        documents générés. La Configuration propose un raccourci pour y accéder, et un
        moyen de choisir un autre dossier — par exemple un dossier réseau, pour que
        plusieurs postes travaillent sur les mêmes mémoires.
      </p>
      <p className="muted">
        Jamais dans le dossier habituel des données d&apos;application : Word refuse
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
        <li>
          les styles : un style « Titre 1 » à « Titre 9 » par niveau de chapitre (gras,
          couleur, taille...), et un style « Normal » pour tout le texte courant,
        </li>
        <li>le pied de page et le numéro de page,</li>
        <li>le format et les marges.</li>
      </ul>
      <p>
        À chaque génération, l&apos;application part d&apos;une copie du gabarit. Pour
        chaque chapitre, elle tape elle-même son titre avec le style « Titre » du bon
        niveau (1 pour un chapitre principal, 2 pour un sous-chapitre, etc.), puis verse à
        la suite le contenu du fichier attaché, sans y toucher. C&apos;est donc le gabarit
        qui donne son allure à tout le document — styles, marges, en-tête, pied de page.
      </p>

      <h3>Rédiger un fichier de contenu</h3>
      <p>
        Un fichier de contenu est un <b>.docx ordinaire</b>, écrit indépendamment du
        gabarit et du mémoire — vous ne voyez jamais le titre du chapitre en l&apos;écrivant,
        c&apos;est normal, l&apos;application l&apos;ajoute au moment de la génération.
      </p>
      <ol>
        <li>Créez un nouveau document Word, vide.</li>
        <li>
          Écrivez votre texte normalement (style « Normal », celui par défaut). N&apos;
          appliquez vous-même aucun style « Titre » : ces styles sont réservés au titre que
          l&apos;application ajoute, un style de titre déjà présent dans votre fichier
          ferait doublon dans le sommaire.
        </li>
        <li>
          Pas de titre de chapitre, pas de sommaire, pas de numérotation manuelle — voir
          plus haut, l&apos;application s&apos;en charge.
        </li>
        <li>
          Ne vous demandez pas s&apos;il faut une ligne vide en tête ou en fin de fichier,
          avant que le titre ne soit ajouté devant : l&apos;application la retire toute
          seule si vous en laissez une, et ne change rien si vous n&apos;en mettez pas.
        </li>
        <li>
          Pour une image qui doit toujours rester avec le texte qui l&apos;accompagne
          (légende, phrase d&apos;introduction) : sélectionnez les paragraphes concernés,
          puis Paragraphe → Enchaînements → cochez « Avec le suivant » et/ou « Lignes
          solidaires ». Ce réglage est conservé tel quel lors de l&apos;assemblage.
        </li>
        <li>
          Enregistrez le fichier, puis attachez-le au chapitre depuis le plan du mémoire
          (« + contenu », ou l&apos;icône œil pour en remplacer un déjà attaché).
        </li>
      </ol>
      <p>
        Ouvert dans Word, le gabarit lui-même ne montre presque rien : un titre de chapitre
        y apparaîtrait dans chaque mémoire généré. Pour voir à quoi ressembleront les
        titres et le texte courant sans toucher à vos données, utilisez <b>Aperçu du
        style</b> : un document à part, jamais enregistré comme gabarit, régénéré à chaque
        clic pour rester à jour.
      </p>
      <p>
        Le logo n&apos;en fait pas partie : chaque mémoire porte le sien, réglé depuis son
        propre plan. Celui d&apos;un modèle, plus bas dans cette page, est celui que reçoit
        un nouveau mémoire parti de ce modèle.
      </p>
      <p>
        Pour le reste — coordonnées en pied de page, couleurs des titres, marges — ouvrez
        le gabarit dans Word. Une modification profite à tous les mémoires suivants.
      </p>
      <p className="muted">
        Le titre du sommaire se règle ici aussi : c&apos;est le texte affiché au-dessus de
        la table des matières.
      </p>
      <p className="muted">
        Les « consignes générales pour l&apos;IA » sont ajoutées à la fin de chaque texte
        copié par le bouton « Copier consigne pour IA », dans l&apos;éditeur d&apos;un
        mémoire ou d&apos;un modèle — utile pour fixer une fois pour toute l&apos;équipe le
        ton ou le vocabulaire attendu, plutôt que de le répéter à chaque fois.
      </p>
    </>
  )
}

export function LogoHelp(): JSX.Element {
  return (
    <>
      <p>
        Deux emplacements, indépendants l&apos;un de l&apos;autre : le logo en haut à
        droite, et un second en haut à gauche — pour un groupement ou un client dont le
        logo doit figurer sur ce dossier précis, à côté du vôtre.
      </p>
      <p>
        Ni l&apos;un ni l&apos;autre n&apos;appartient qu&apos;à ce mémoire. Ils ont été
        copiés depuis l&apos;exemple au moment de la création, mais dès cet instant tout
        est indépendant : changer l&apos;un ne touche ni l&apos;autre emplacement, ni un
        autre mémoire.
      </p>
      <p className="muted">
        Pour changer ce que propose un modèle aux futurs mémoires, réglez-le sur ce
        modèle, dans la Configuration.
      </p>
    </>
  )
}

export function ModelesHelp(): JSX.Element {
  return (
    <>
      <p>
        Un modèle est le <b>point de départ d&apos;un nouveau mémoire</b>. Mettez-y le plan
        que vous réutilisez le plus souvent, avec vos contenus habituels — et son logo,
        celui qui apparaît sur un mémoire tout juste créé à partir de lui.
      </p>
      <p>
        Quand vous créez un mémoire, l&apos;application en fait une copie complète et
        indépendante du modèle choisi, logo compris. Modifier ce mémoire ne touche pas au
        modèle, et inversement.
      </p>
      <p>
        Un seul modèle suffit dans la plupart des cas. Ajoutez-en un second — en
        dupliquant un modèle existant, puis en l&apos;adaptant — quand différents types
        d&apos;affaires méritent des plans de départ différents.
      </p>
      <p className="muted">
        Mieux vaut un modèle <b>trop fourni que trop pauvre</b> : il est plus rapide de
        supprimer un chapitre inutile que d&apos;aller rechercher un fichier oublié.
      </p>
    </>
  )
}

export function BibliothequeHelp(): JSX.Element {
  return (
    <>
      <p>
        La bibliothèque est le dossier où vit tout ce que l&apos;application possède : le
        gabarit, les contenus, les modèles, les mémoires et les documents générés. Par
        défaut, c&apos;est <b>Documents\XSProMemo</b>, sur ce poste.
      </p>
      <p>
        <b>Ouvrir un dossier</b> et <b>Créer un dossier</b> permettent de pointer ailleurs
        — un autre disque, ou un dossier réseau accessible depuis plusieurs postes de
        l&apos;entreprise. Les deux ouvrent le même sélecteur ; le résultat dépend
        seulement du dossier choisi : s&apos;il n&apos;existe pas encore, il est créé après
        confirmation ; s&apos;il est vide, il reçoit une copie complète de la bibliothèque
        actuelle ; s&apos;il en contient déjà une, elle est rejointe telle quelle, sans
        rien recopier.
      </p>
      <p>
        L&apos;application redémarre après un changement : trop d&apos;écrans dépendent de
        l&apos;ancien dossier pour continuer proprement sans repartir de zéro.
      </p>
      <p className="muted">
        Si deux personnes modifient le même mémoire au même moment depuis deux postes
        différents, le dernier enregistré l&apos;emporte — pas de fusion, pas de blocage.
        Chaque poste doit avoir Word installé pour générer un document.
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
          profondeur. Il se met à jour tout seul si vous réordonnez. Sa taille et son
          style suivent la profondeur — un chapitre principal ressort, un sous-chapitre
          plus profond s&apos;efface — pour repérer la structure d&apos;un coup d&apos;œil.
        </li>
        <li>
          <b>Le titre</b> se modifie en cliquant dessus. C&apos;est lui qui apparaîtra dans
          le document et dans le sommaire.
        </li>
        <li>
          <b>Le contenu</b> : un fichier Word. <i>+ contenu</i> ou l&apos;icône <b>œil</b>
          (une fois un contenu attaché) ouvrent le même menu — Ouvrir contenu, Remplacer
          contenu, Retirer contenu, Ajouter un sous-chapitre, et Insérer chapitre avant.
        </li>
        <li>
          <b>Clic droit</b> n&apos;importe où sur la ligne ouvre ce même menu, quel que
          soit le niveau ou l&apos;état du chapitre.
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
          <b>▾ / ▸</b> replie ou déplie les sous-chapitres, pour les plans longs.
          <b> ↑ ↓</b> déplacent la ligne, <b>✕</b> supprime.
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
        Inutile de vous demander s&apos;il faut laisser une ligne vide en tête ou en fin de
        fichier avant que le titre du chapitre ne soit ajouté : l&apos;application la
        retire automatiquement si vous en laissez une, et ne change rien si vous n&apos;en
        mettez pas. Le titre reste toujours collé à ce qui suit, il ne se retrouve jamais
        seul en bas d&apos;une page.
      </p>
      <p className="muted">
        Pour qu&apos;une image reste toujours avec le texte qui l&apos;accompagne (légende,
        phrase d&apos;introduction), sélectionnez les paragraphes concernés dans Word et
        cochez Paragraphe → Enchaînements → « Avec le suivant » et/ou « Lignes solidaires »
        — l&apos;application respecte ce réglage lors de l&apos;assemblage.
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
          <b>Nouveau mémoire</b> : part d&apos;une copie d&apos;un modèle (à choisir s&apos;il
          y en a plusieurs). Vous retirez ce qui ne s&apos;applique pas, vous ajoutez ce qui
          manque.
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
        Les documents produits sont rangés dans le dossier « documents » de la
        bibliothèque. La Configuration propose un raccourci vers ce dossier.
      </p>
    </>
  )
}
