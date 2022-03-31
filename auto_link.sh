#!/bin/bash
rm -rf build
npm uninstall dependency-why -g
npm run build
npm link
