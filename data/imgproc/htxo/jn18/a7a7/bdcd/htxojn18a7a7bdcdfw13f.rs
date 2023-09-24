let mut d = DataObject::new();

let url = "http://192.168.100.61:7860/sdapi/v1/txt2img";
let mut params = DataObject::new();
params.put_string("prompt", &prompt);
params.put_int("steps", 32);
params.put_int("width", 1280);
params.put_int("height", 720);
params.put_float("cfg_scale", 7.0);

let mut o = DataObject::new();
o.put_string("sd_model_checkpoint", "juggernautXL_version3"); //"dreamshaperXL10_alpha2Xl10"); //"juggernautXL_version1"); //"RealitiesEdgeXL_");
params.put_object("override_settings", o.clone());

let resp = attohttpc::post(&url)
  .read_timeout(Duration::new(600, 0))
  .header("Accept", "application/json")
  .header("Content-Type", "application/json")
  .text(params.to_string())
  .send();
let xxx = format!("{:?}", resp);
println!("{}", xxx);
if resp.is_ok() {
  let resp = resp.unwrap();
  let response = resp.text().unwrap();
  let data = DataObject::from_string(&response);
  let imgs = data.get_array("images");
  let img = imgs.get_string(0);

  let mut params = DataObject::new();
  params.put_float("upscaling_resize", 1.5);
  params.put_string("upscaler_1", "4x-UltraSharp");
  //params.put_string("upscaler_2", "4x_NMKD-Siax_200k");
  //params.put_float("extras_upscaler_2_visibility", 0.5);
  params.put_string("image", &img);

  let url = "http://192.168.100.61:7860/sdapi/v1/extra-single-image";
  let resp = attohttpc::post(&url)
    .read_timeout(Duration::new(600, 0))
    .header("Accept", "application/json")
    .header("Content-Type", "application/json")
    .text(params.to_string())
    .send();
  let xxx = format!("{:?}", resp);
  println!("{}", xxx);
  if resp.is_ok() {
    let resp = resp.unwrap();
    let response = resp.text().unwrap();
    let x = DataObject::from_string(&response);
    let img = x.get_string("image");
    
    let char2: Vec<char> = img.chars().collect::<Vec<_>>();
    let b = Base64::decode(char2);
    
    let root = Path::new("/home/mraiser/Newbound/runtime/chuckme/html");
    let txtroot = root.join("txt");
    let f = txtroot.join(id.clone());
    let _x = std::fs::write(&f, &prompt.as_bytes()).unwrap();
    
    let genroot = root.join("gen");
    let filename = id.clone()+".png";
    let f = genroot.join(filename.clone());
    let _x = std::fs::write(&f, &b).unwrap();
  
    let img = "../chuckme/gen/".to_string()+&filename;
    d.put_string("img", &img);
  }
  else {
    d.put_string("err", &xxx);
  }
}
else {
  d.put_string("err", &xxx);
}

d