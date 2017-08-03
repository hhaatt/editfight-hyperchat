#!/bin/bash
set -ex

scp public/index.html ubuntu@hyperchat.editfight.com:app/public
scp index.js ubuntu@hyperchat.editfight.com:app
ssh ubuntu@hyperchat.editfight.com sudo service editfight restart
