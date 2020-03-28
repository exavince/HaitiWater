# SSH
**Créer un proxy SSH**
Vous devez créer dans le dossier .ssh un fichier nommé config. Dans ce ficher cous mettrez les lignes suivantes:
```
Host ucl
        Hostname studssh.info.ucl.ac.be
        User [identifiant UCL]
        AddressFamily inet

Host VM
        User [username]
        Hostname [Nom de l'hôte]
        ProxyJump ucl
```
Vous pouvez maintenant vous connecter en tapant:
```
ssh VM
```

# Base de données
***Toutes les opérations sur la DB nécessite d'être connecté au réseau UCL.
Si vous ne pouvez pas vous y connecter, veuillez utiliser un proxy SSH (voir plus haut)***

**Connection à la DB**
```
psql -d haitiwater --host pgsql.uclouvain.be -- port 5441 --user haitiwater
```
**Sauvergarde de la DB**
```
pg_dump -U haitiwater -h pgsql.uclouvain.be -p 5441 -d haitiwater > backup.sql
```

# Transfert SCP
Si l'hôte et le destinataire sont des PC distants:
```
scp [hôte]:/path/to/file [destination]:/path/to/file
```
Hôte et destination étant l’adresse du pc de la source et du destinataire.

Si l'hôte est le PC sur lequel vous être connecté alors utilisez ceci:
```
scp /path/to/file [destination]:/path/to/file
```

Pour simplifier le transfert de fichier entre le serveur et la VM, il existe un script dans le dossier ./script :
```
./transfert /path/to/file/in/server /path/to/file/in/VM
```
