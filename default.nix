with (import <nixpkgs> {});
let
  LLP = with pkgs; [
    openssl
    pkg-config
    cudatoolkit
    cudaPackages.cudnn
    blas 
    lapack
    linuxPackages.nvidia_x11
    cargo
    rustc
    git
    cmake
  ];
  LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath LLP;
in  
stdenv.mkDerivation {
  name = "newbound-env";
  buildInputs = LLP;
  src = null;
  shellHook = ''
    SOURCE_DATE_EPOCH=$(date +%s)
    export LD_LIBRARY_PATH=${LD_LIBRARY_PATH}
    export CUDAToolkit_ROOT=${cudatoolkit.out}:${cudatoolkit.lib}
    export CUDA_ROOT=${cudatoolkit.out}
    export CUDNN_LIB=${cudaPackages.cudnn}
  '';
}
