#!/bin/bash

recup="haitiwater-server:"$1
send="haitiwater-VM:"$2

scp $recup ./transfert.md
scp ./transfert.md $send

rm transfert.md
