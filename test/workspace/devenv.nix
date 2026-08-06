{ pkgs, ... }:

{
  env.VARIABLE = "value";

  languages.python = {
    enable = true;
    venv = {
      enable = true;
      requirements = ''
        black
      '';
    };
  };
}
