{ pkgs, ... }:
{
  languages.javascript.enable = true;
  languages.javascript.npm.enable = true;
  languages.typescript.enable = true;

  packages = [
    pkgs.nixfmt
  ];
}
