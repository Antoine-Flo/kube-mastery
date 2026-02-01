# Tester l’app sur ton téléphone

## 1. Lancer le serveur en écoute sur le réseau

Pour que le téléphone puisse accéder au dev server, il doit écouter sur toutes les interfaces (pas seulement localhost) :

```sh
npm run dev -- --host
```

Ou avec npx :

```sh
npx astro dev --host
```

Astro affichera une URL du type `http://192.168.x.x:4321` (ton IP locale).

## 2. Trouver ton IP si besoin

- **Linux / WSL** : `hostname -I | awk '{print $1}'` ou `ip addr`
- **macOS** : Préférences Système → Réseau, ou `ipconfig getifaddr en0`

Tu veux l’adresse du type `192.168.x.x` (réseau local).

## 3. Sur le téléphone

1. Connecte le téléphone au **même Wi‑Fi** que la machine qui lance `npm run dev`.
2. Ouvre le navigateur et va sur `http://<TON_IP>:4321` (ex. `http://192.168.1.10:4321`).
3. Ouvre une leçon avec le terminal, tape du texte puis **espace** : tu devrais obtenir un seul espace sans doublon (ex. "toto " et non "totoo to").

## 4. Option : tunnel (si le Wi‑Fi bloque ou pour test externe)

- [ngrok](https://ngrok.com/) : `ngrok http 4321` → une URL publique temporaire.
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) : idem, URL publique.

Tu peux partager l’URL avec quelqu’un d’autre pour qu’il teste sur son téléphone.
