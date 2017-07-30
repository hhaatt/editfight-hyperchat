#!/bin/bash
set -ex

scp -r public ubuntu@lines.editfight.com:
scp index.js ubuntu@lines.editfight.com:app
scp -r lib  ubuntu@lines.editfight.com:app
ssh ubuntu@lines.editfight.com sudo service editfight restart
