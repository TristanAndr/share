export type Locale = 'fr' | 'en';

export interface Translations {
  dm: {
    title: string;
    newDM: string;
    placeholder: string;
    noMessages: string;
    allUsers: string;
    sendMessage: string;
  };
  login: {
    title: string; subtitle: string; email: string; emailPlaceholder: string;
    password: string; passwordPlaceholder: string; submit: string; loading: string;
    noAccount: string; signupLink: string;
  };
  signup: {
    title: string; subtitle: string; email: string; emailPlaceholder: string;
    username: string; usernamePlaceholder: string; password: string; passwordPlaceholder: string;
    submit: string; loading: string; hasAccount: string; loginLink: string;
  };
  chat: {
    createServer: string; joinServer: string; copyInvite: string; createChannel: string;
    manageMembers: string; manageBans: string; leaveServer: string; deleteServer: string;
    channels: string; noChannel: string; joinOrCreate: string; member: string; online: string;
    logout: string; deleteChannel: string; create: string;
    firstMessage: string; editHint: string; editMessage: string; deleteMessage: string; edited: string;
    selectChannel: string; welcome: string; clickToChat: string; createOrJoin: string;
    messagePlaceholder: string; members: string; onlineGroup: string; offlineSuffix: string;
    you: string; isTyping: string; areTyping: string; manyTyping: string;
    gifSearchPlaceholder: string; gifEmpty: string; gifLoading: string;
  };
  modal: {
    cancel: string; close: string; confirm: string; create: string; delete: string;
    leave: string; join: string; kick: string; unban: string;
    createServer: { title: string; desc: string; label: string; placeholder: string; };
    joinServer: { title: string; desc: string; label: string; };
    createChannel: { title: string; desc: string; label: string; placeholder: string; };
    invite: { title: string; desc: string; clickToCopy: string; };
    leaveServer: { title: string; warning: string; };
    deleteServer: { title: string; warning: string; };
    manageMembers: { title: string; desc: string; };
    confirmTransfer: { title: string; transferTo: string; to: string; becomeAdmin: string; };
    confirmKick: { title: string; kick: string; from: string; canReturn: string; };
    confirmBan: {
      title: string; ban: string; from: string; durationLabel: string;
      durationPlaceholder: string; banWithDuration: string; banPermanent: string;
    };
    manageBans: {
      title: string; desc: string; noBans: string; bannedBy: string;
      permanent: string; expired: string; until: string;
    };
  };
  memberMenu: {
    makeAdmin: string; removeAdmin: string; transferServer: string;
    kickFromServer: string; ban: string;
  };
  system: {
    joined: string;
    kicked: string;
    bannedPermanent: string;
    bannedTemporary: string;
  };
  errors: {
    banPermanent: string;
    banTemporary: string;
  };
}

const translations: Record<Locale, Translations> = {
  fr: {
    dm: {
      title: 'Messages privés',
      newDM: 'Nouveau message',
      placeholder: 'Envoyer un message à',
      noMessages: 'Aucun message pour le moment. Dites bonjour !',
      allUsers: 'Utilisateurs',
      sendMessage: 'Envoyer un message privé',
    },
    // Auth - Login
    login: {
      title: 'Bon retour !',
      subtitle: 'Nous sommes si heureux de vous revoir !',
      email: 'Email',
      emailPlaceholder: 'Votre email',
      password: 'Mot de passe',
      passwordPlaceholder: 'Votre mot de passe',
      submit: 'Se connecter',
      loading: 'Connexion...',
      noAccount: 'Pas encore de compte ?',
      signupLink: "S'inscrire",
    },
    // Auth - Signup
    signup: {
      title: 'Créer un compte',
      subtitle: 'Rejoignez la communauté dès maintenant',
      email: 'Email',
      emailPlaceholder: 'Votre email',
      username: "Nom d'utilisateur",
      usernamePlaceholder: 'Votre pseudo',
      password: 'Mot de passe',
      passwordPlaceholder: 'Choisissez un mot de passe',
      submit: "S'inscrire",
      loading: 'Inscription...',
      hasAccount: 'Déjà un compte ?',
      loginLink: 'Se connecter',
    },
    // Chat general
    chat: {
      createServer: 'Créer un serveur',
      joinServer: 'Rejoindre un serveur',
      copyInvite: "Copier l'invitation",
      createChannel: 'Créer un channel',
      manageMembers: 'Gérer les membres',
      manageBans: 'Gérer les bans',
      leaveServer: 'Quitter le serveur',
      deleteServer: 'Supprimer le serveur',
      channels: 'Salons',
      noChannel: 'Aucun channel',
      joinOrCreate: 'Créez ou rejoignez un serveur',
      member: 'Membre',
      online: 'En ligne',
      logout: 'Se déconnecter',
      deleteChannel: 'Supprimer',
      create: 'Créer',
      // Main chat area
      firstMessage: 'Premier message dans',
      editHint: 'Entrée pour valider · Échap pour annuler',
      editMessage: 'Modifier',
      deleteMessage: 'Supprimer',
      edited: 'modifié',
      selectChannel: 'Sélectionnez un channel',
      welcome: 'Bienvenue !',
      clickToChat: 'Cliquez sur un salon pour chatter',
      createOrJoin: 'Créez ou rejoignez un serveur depuis la barre latérale',
      messagePlaceholder: 'Message',
      // Members sidebar
      members: 'Membres',
      onlineGroup: 'En ligne',
      offlineSuffix: '— hors ligne',
      you: '(vous)',
      // Typing
      isTyping: "est en train d'écrire...",
      areTyping: 'écrivent...',
      manyTyping: 'personnes écrivent...',
      gifSearchPlaceholder: 'Rechercher un GIF...',
      gifEmpty: 'Aucun résultat',
      gifLoading: 'Chargement...',
    },
    // Modals
    modal: {
      cancel: 'Annuler',
      close: 'Fermer',
      confirm: 'Confirmer',
      create: 'Créer',
      delete: 'Supprimer',
      leave: 'Quitter',
      join: 'Rejoindre',
      kick: 'Expulser',
      unban: 'Débannir',
      createServer: {
        title: 'Créer un serveur',
        desc: 'Donnez un nom à votre serveur',
        label: 'Nom du serveur',
        placeholder: 'Mon serveur',
      },
      joinServer: {
        title: 'Rejoindre un serveur',
        desc: "Entrez le code d'invitation",
        label: "Code d'invitation",
      },
      createChannel: {
        title: 'Créer un channel',
        desc: 'Nouveau salon dans',
        label: 'Nom',
        placeholder: 'nouveau-salon',
      },
      invite: {
        title: 'Inviter des amis',
        desc: "Code d'invitation pour",
        clickToCopy: 'Cliquez pour copier',
      },
      leaveServer: {
        title: 'Quitter le serveur',
        warning: "Vous aurez besoin d'un code d'invitation pour revenir.",
      },
      deleteServer: {
        title: 'Supprimer le serveur',
        warning: 'Cette action est irréversible.',
      },
      manageMembers: {
        title: 'Gérer les membres',
        desc: 'Gérez les rôles dans',
      },
      confirmTransfer: {
        title: "Transférer l'ownership",
        transferTo: 'Transférer le serveur',
        to: 'à',
        becomeAdmin: 'Vous deviendrez Administrateur.',
      },
      confirmKick: {
        title: 'Expulser un membre',
        kick: 'Expulser',
        from: 'du serveur',
        canReturn: "Il pourra revenir avec un code d'invitation.",
      },
      confirmBan: {
        title: 'Bannir un membre',
        ban: 'Bannir',
        from: 'du serveur',
        durationLabel: 'Durée (en minutes) — laisser vide pour un ban définitif',
        durationPlaceholder: 'Ex : 60 (1h), 1440 (1j) — vide = définitif',
        banWithDuration: 'Bannir ({duration} min)',
        banPermanent: 'Bannir définitivement',
      },
      manageBans: {
        title: 'Bans du serveur',
        desc: 'Utilisateurs bannis de',
        noBans: 'Aucun ban actif.',
        bannedBy: 'Banni par',
        permanent: 'Définitif',
        expired: 'Expiré',
        until: "Jusqu'au",
      },
    },
    // Member dropdown menu
    memberMenu: {
      makeAdmin: 'Nommer Administrateur',
      removeAdmin: 'Retirer Administrateur',
      transferServer: 'Transférer le serveur',
      kickFromServer: 'Expulser du serveur',
      ban: 'Bannir',
    },
    system: {
      joined: 'a rejoint le serveur',
      kicked: 'a été expulsé du serveur',
      bannedPermanent: 'a été banni définitivement du serveur',
      bannedTemporary: 'a été banni temporairement jusqu\'au',
    },
    errors: {
      banPermanent: 'Vous êtes banni définitivement de ce serveur',
      banTemporary: 'Vous êtes banni jusqu\'au',
    },
  },

  en: {
    dm: {
      title: 'Direct Messages',
      newDM: 'New message',
      placeholder: 'Message',
      noMessages: 'No messages yet. Say hello!',
      allUsers: 'Users',
      sendMessage: 'Send a direct message',
    },
    // Auth - Login
    login: {
      title: 'Welcome back!',
      subtitle: "We're so happy to see you again!",
      email: 'Email',
      emailPlaceholder: 'Your email',
      password: 'Password',
      passwordPlaceholder: 'Your password',
      submit: 'Log in',
      loading: 'Logging in...',
      noAccount: 'No account yet?',
      signupLink: 'Sign up',
    },
    // Auth - Signup
    signup: {
      title: 'Create an account',
      subtitle: 'Join the community now',
      email: 'Email',
      emailPlaceholder: 'Your email',
      username: 'Username',
      usernamePlaceholder: 'Your username',
      password: 'Password',
      passwordPlaceholder: 'Choose a password',
      submit: 'Sign up',
      loading: 'Signing up...',
      hasAccount: 'Already have an account?',
      loginLink: 'Log in',
    },
    // Chat general
    chat: {
      createServer: 'Create a server',
      joinServer: 'Join a server',
      copyInvite: 'Copy invitation',
      createChannel: 'Create channel',
      manageMembers: 'Manage members',
      manageBans: 'Manage bans',
      leaveServer: 'Leave server',
      deleteServer: 'Delete server',
      channels: 'Channels',
      noChannel: 'No channels',
      joinOrCreate: 'Create or join a server',
      member: 'Member',
      online: 'Online',
      logout: 'Log out',
      deleteChannel: 'Delete',
      create: 'Create',
      // Main chat area
      firstMessage: 'First message in',
      editHint: 'Enter to save · Escape to cancel',
      editMessage: 'Edit',
      deleteMessage: 'Delete',
      edited: 'edited',
      selectChannel: 'Select a channel',
      welcome: 'Welcome!',
      clickToChat: 'Click on a channel to chat',
      createOrJoin: 'Create or join a server from the sidebar',
      messagePlaceholder: 'Message',
      // Members sidebar
      members: 'Members',
      onlineGroup: 'Online',
      offlineSuffix: '— offline',
      you: '(you)',
      // Typing
      isTyping: 'is typing...',
      areTyping: 'are typing...',
      manyTyping: 'people are typing...',
      gifSearchPlaceholder: 'Search for a GIF...',
      gifEmpty: 'No results',
      gifLoading: 'Loading...',
    },
    // Modals
    modal: {
      cancel: 'Cancel',
      close: 'Close',
      confirm: 'Confirm',
      create: 'Create',
      delete: 'Delete',
      leave: 'Leave',
      join: 'Join',
      kick: 'Kick',
      unban: 'Unban',
      createServer: {
        title: 'Create a Server',
        desc: 'Give your server a name',
        label: 'Server name',
        placeholder: 'My server',
      },
      joinServer: {
        title: 'Join a Server',
        desc: 'Enter the invite code',
        label: 'Invite code',
      },
      createChannel: {
        title: 'Create a Channel',
        desc: 'New channel in',
        label: 'Name',
        placeholder: 'new-channel',
      },
      invite: {
        title: 'Invite Friends',
        desc: 'Invite code for',
        clickToCopy: 'Click to copy',
      },
      leaveServer: {
        title: 'Leave Server',
        warning: 'You will need an invite code to return.',
      },
      deleteServer: {
        title: 'Delete Server',
        warning: 'This action is irreversible.',
      },
      manageMembers: {
        title: 'Manage Members',
        desc: 'Manage roles in',
      },
      confirmTransfer: {
        title: 'Transfer Ownership',
        transferTo: 'Transfer server',
        to: 'to',
        becomeAdmin: 'You will become Administrator.',
      },
      confirmKick: {
        title: 'Kick a Member',
        kick: 'Kick',
        from: 'from server',
        canReturn: 'They can return with an invite code.',
      },
      confirmBan: {
        title: 'Ban a Member',
        ban: 'Ban',
        from: 'from server',
        durationLabel: 'Duration (in minutes) — leave empty for permanent ban',
        durationPlaceholder: 'E.g.: 60 (1h), 1440 (1d) — empty = permanent',
        banWithDuration: 'Ban ({duration} min)',
        banPermanent: 'Ban permanently',
      },
      manageBans: {
        title: 'Server Bans',
        desc: 'Banned users from',
        noBans: 'No active bans.',
        bannedBy: 'Banned by',
        permanent: 'Permanent',
        expired: 'Expired',
        until: 'Until',
      },
    },
    // Member dropdown menu
    memberMenu: {
      makeAdmin: 'Make Administrator',
      removeAdmin: 'Remove Administrator',
      transferServer: 'Transfer Server',
      kickFromServer: 'Kick from Server',
      ban: 'Ban',
    },
    system: {
      joined: 'joined the server',
      kicked: 'was kicked from the server',
      bannedPermanent: 'was permanently banned from the server',
      bannedTemporary: 'was temporarily banned until',
    },
    errors: {
      banPermanent: 'You are permanently banned from this server',
      banTemporary: 'You are banned until',
    },
  },
};

export default translations;
