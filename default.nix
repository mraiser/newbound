with (import <nixpkgs> {});
stdenv.mkDerivation {
  name = "pip-env";
  buildInputs = [
    # System requirements.
    readline
    openssl
    pkg-config
    ffmpeg-full
    sox

    # Python requirements (enough to get a virtualenv going).
    python310Full
    python310Packages.virtualenv
    python310Packages.pip
    python310Packages.setuptools
    python310Packages.numpy
    python310Packages.face_recognition
    (python310Packages.opencv4.override {enableGtk2 = true;})
  ];
  src = null;
  shellHook = ''
    # Allow the use of wheels.
    SOURCE_DATE_EPOCH=$(date +%s)

    # Augment the dynamic linker path
    export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:${R}/lib/R/lib:${readline}/lib
  '';
}
