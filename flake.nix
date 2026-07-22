{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    dev-python = {
      url = "github:agoose77/dev-flakes/v10?dir=python";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };
  outputs = {
    self,
    nixpkgs,
    dev-python,
  }: let
    forAllSystems =
      nixpkgs.lib.genAttrs nixpkgs.lib.systems.flakeExposed;
  in {
    devShells = forAllSystems (
      system: let
        python = pkgs.python313;
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
        # Configure the hook for enabling venvs
        # I think there's a way to auto-detect this, but
        # let's worry about that another time
        venvHook =
          dev-python.packages.${system}.nix-ld-venv-hook.override
          {python = python;};
        # Define our env packages (including the above)
        packages =
          [
            python
            venvHook
          ]
          ++ (with pkgs; [
            cmake
            ninja
            gcc
            pre-commit
            # Infra packages
            nodejs_22
            pnpm
          ]);
        # Unset these unwanted env vars
        # PYTHONPATH bleeds from Nix Python packages
        unwantedEnvPreamble = ''
          unset SOURCE_DATE_EPOCH PYTHONPATH
        '';
      in {
        default = pkgs.mkShell {
          inherit packages;
          # Define additional input for patching interpreter

          venvDir = ".venv";

          # Drop bad env vars on activation
          postShellHook = unwantedEnvPreamble;

          # Setup venv by patching interpreter with LD_LIBRARY_PATH
          # This is required because ld does not exist on Nix systems
          postVenvCreation =
            # Install package
            ''
              ${unwantedEnvPreamble}
              pip install -e ".[dev]"
            '';
        };
      }
    );
  };
}
