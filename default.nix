with (import <nixpkgs> {});
let
  LLP = with pkgs; [
    gcc
    cargo
    rustc
  ];
  LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath LLP;
in  
stdenv.mkDerivation {
  name = "udo-env";
  buildInputs = LLP;
  src = null;
  shellHook = ''
    SOURCE_DATE_EPOCH=$(date +%s)
    export LD_LIBRARY_PATH=${LD_LIBRARY_PATH}
  '';
}
