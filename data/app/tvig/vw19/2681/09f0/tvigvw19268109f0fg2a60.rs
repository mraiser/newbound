  let mut ja = DataArray::new();

  #[cfg(debug_assertions)]
  let bin = "target/debug/newbound";

  #[cfg(not(debug_assertions))]
  let bin = "target/release/newbound";

  ja.push_string(&bin);

  ja.push_string("exec");
  ja.push_string(&lib);
  ja.push_string(&ctl);
  ja.push_string(&cmd);
  ja.push_string(&args.to_string());

  system_call(ja)
}

pub fn features() -> String {
  let mut features = "".to_string();

  #[cfg(feature="serde_support")]
  {
    features += ",serde_support";
  }

  #[cfg(feature="reload")]
  {
    features += ",reload";
  }

  #[cfg(feature="python_runtime")]
  {
    features += ",python_runtime";
  }

  #[cfg(feature="javascript_runtime")]
  {
    features += ",javascript_runtime";
  }

  #[cfg(feature="java_runtime")]
  {
    features += ",java_runtime";
  }

  #[cfg(feature="webview")]
  {
    features += ",webview";
  }

  if features != "".to_string() {
    features = features[1..].to_string();
  }
  features
