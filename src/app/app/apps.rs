use ndata::dataobject::*;
use std::fs;
use flowlang::datastore::*;
use std::path::Path;
use ndata::dataarray::DataArray;
use flowlang::flowlang::file::read_properties::read_properties;

pub fn execute(_o: DataObject) -> DataObject {
let ax = apps();
let mut o = DataObject::new();
o.put_array("a", ax);
o
}

pub fn apps() -> DataArray {
let store = DataStore::new(); 
let mut ja = DataArray::new();
let p = store.root.parent().unwrap().join("runtime");
for file in fs::read_dir(&p).unwrap() {
  let path = file.unwrap().path();
  if path.is_dir() {
    let p = path.join("app.properties");
    if p.exists() {
      let mut appdata = read_properties(p.into_os_string().into_string().unwrap());
      
      let name:String = path.file_name().unwrap().to_str().unwrap().to_string();
      let b = DataStore::globals().get_object("system").get_object("apps").has(&name);
      appdata.put_boolean("active", b);
      
      let ctldb = appdata.get_string("ctldb");
      let ctlid = appdata.get_string("ctlid");
      
      let path = store.get_data_file(&ctldb, &ctlid);
      if Path::new(&path).exists() {
        let ctl = store.get_data(&ctldb, &ctlid).get_object("data");
        if ctl.has("cmd") {
          let cmds = ctl.get_array("cmd");
          let mut o = DataObject::new();
          for cmd in cmds.objects(){
            let cmd = cmd.object();
            let name = cmd.get_string("name");
            let cmdid = cmd.get_string("id");
            let cmd = store.get_data(&ctldb, &cmdid);

            let mut c = DataObject::new();

            if cmd.has("readers") { 
              let r = cmd.get_array("readers");
              let mut groups = "".to_string();
              for g in r.objects() {
                if groups != "" { groups += ","; }
                groups += &g.string();
              }
              c.put_array("include", r);
              c.put_string("groups", &groups);
            }


            let data = cmd.get_object("data");
            let typ = &data.get_string("type");
            //let name = &data.get_string("name");

            let codename = &data.get_string(typ);
            if store.get_data_file(&ctldb, codename).exists(){
              let code = store.get_data(&ctldb, codename).get_object("data");
              if code.has("desc") { c.put_string("desc", &code.get_string("desc")); }

              let mut params = DataArray::new();
              if code.has("params") {
                let p = &code.get_array("params");
                for d in p.objects() {
                  let d = d.object();
                  let a = d.get_string("name");
                  params.push_string(&a);
                }
              }
              c.put_array("parameters", params);


              o.put_object(&name, c);
            }
          }
          appdata.put_object("commands", o);
        }
      }
      
      ja.push_object(appdata);
    }
  }
}
ja
}

