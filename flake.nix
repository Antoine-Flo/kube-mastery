{
  description = "kube-mastery dev environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";

  outputs = { self, nixpkgs }: let
    supportedSystems = [ "x86_64-linux" "aarch64-linux" ];
    forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    pkgsFor = system: nixpkgs.legacyPackages.${system};
  in {
    devShells = forAllSystems (system: {
      default = (pkgsFor system).mkShell {
        buildInputs = [
          (pkgsFor system).nodejs_24
        ];
        shellHook = ''
          echo "Node: $(node -v) — npm: $(npm -v)"
        '';
      };
    });
  };
}
