#!/bin/sh
# Sideload the May or Shall add-in into Word for Mac.
set -e
WEF="$HOME/Library/Containers/com.microsoft.Word/Data/Documents/wef"
mkdir -p "$WEF"
cp "$(dirname "$0")/manifest.xml" "$WEF/may-or-shall-manifest.xml"
echo "Manifest copied to $WEF"
echo
echo "Next steps:"
echo "  1. One-time: npx office-addin-dev-certs install   (trusted https certs for localhost)"
echo "  2. Run the app with HTTPS: npm run dev:addin"
echo "  3. Open Word > Home ribbon > 'Cards' button (May or Shall group)."
echo "     If it doesn't appear: Insert > Add-ins > My Add-ins > Developer Add-ins."
