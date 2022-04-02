#!/bin/bash
grep -r $1 --exclude-dir='node_modules' --exclude-dir='.git' --exclude-dir='es' --exclude='*.map' --exclude='*.json' .
