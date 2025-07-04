let src_path = Path::new(&srcdir);

if !src_path.is_dir() {
  return false;
}

let dest_file_path = Path::new(&destfile);
let abs_dest_file_path_str: String = if dest_file_path.is_absolute() {
  destfile.to_string()
} else {
  match env::current_dir() {
    Ok(cwd) => cwd.join(dest_file_path).to_string_lossy().into_owned(),
    Err(_) => {
      return false;
    }
  }
};

let command_string = format!(
  "cd '{}' && zip -qr '{}' .",
  srcdir, // Path to cd into
  abs_dest_file_path_str  // Absolute path for the output zip file
);

let mut cmd_array = DataArray::new();
cmd_array.push_string("bash");
cmd_array.push_string("-c");
cmd_array.push_string(&command_string);

let result_array = system_call(cmd_array);

result_array.get_string("status")  == "ok"

/*
  let method = zip::CompressionMethod::Deflated;
  let x = doit(&srcdir, &destfile, method);
  if x.is_err() { return false; }
  true
}

fn zip_dir<T>(
    it: &mut dyn Iterator<Item = DirEntry>,
    prefix: &str,
    writer: T,
    method: zip::CompressionMethod,
) -> zip::result::ZipResult<()>
where
    T: Write + Seek,
{
    let mut zip = zip::ZipWriter::new(writer);
    let options = FileOptions::default()
        .compression_method(method)
        .unix_permissions(0o755);

    let mut buffer = Vec::new();
    for entry in it {
        let path = entry.path();
        let name = path.strip_prefix(Path::new(prefix)).unwrap();

        // Write file or directory explicitly
        // Some unzip tools unzip files with directory paths correctly, some do not!
        if path.is_file() {
//            println!("adding file {:?} as {:?} ...", path, name);
            #[allow(deprecated)]
            zip.start_file_from_path(name, options)?;
            let mut f = File::open(path)?;

            f.read_to_end(&mut buffer)?;
            zip.write_all(&*buffer)?;
            buffer.clear();
        } else if !name.as_os_str().is_empty() {
            // Only if not root! Avoids path spec / warning
            // and mapname conversion failed error on unzip
//            println!("adding dir {:?} as {:?} ...", path, name);
            #[allow(deprecated)]
            zip.add_directory_from_path(name, options)?;
        }
    }
    zip.finish()?;
    Result::Ok(())
}

fn doit(
    src_dir: &str,
    dst_file: &str,
    method: zip::CompressionMethod,
) -> zip::result::ZipResult<()> {
    if !Path::new(src_dir).is_dir() {
        return Err(ZipError::FileNotFound);
    }

    let path = Path::new(dst_file);
    let file = File::create(&path).unwrap();

    let walkdir = WalkDir::new(src_dir);
    let it = walkdir.into_iter();

    zip_dir(&mut it.filter_map(|e| e.ok()), src_dir, file, method)?;

    Ok(())
*/