{ pkgs, ... }:
{
  languages.javascript.enable = true;
  languages.javascript.npm.enable = true;

  packages = [
    pkgs.nixfmt
  ];
}
