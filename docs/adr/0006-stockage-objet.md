# ADR-0006 — Stockage objet des médias lourds

- **Statut** : En attente — décision au démarrage de la V2

## Contexte

§12.2 : stockage privé des gros fichiers (vidéo, PSD…), uploads reprenables, URL signées,
versionnement, aucun accès public par défaut. Non nécessaire avant la V2.

## Piste privilégiée

**Cloudflare R2** : API compatible S3, aucun frais de sortie, upload multipart, URL signées.

## Critères de décision

Coût stockage + transfert, région UE, versionnement, cycle de vie/rétention, sauvegarde indépendante.
