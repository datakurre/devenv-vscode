{ pkgs, ... }:

{
  packages = [
    pkgs.nodejs_20
  ];

  languages.typescript.enable = true;
}
