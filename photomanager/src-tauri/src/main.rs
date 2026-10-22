#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use std::io::BufReader;
use image::{imageops::FilterType, GenericImageView};
use rayon::prelude::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PhotoMetadata {
  filename: String,
  path: String,
  title: String,
  tags: Vec<String>,
  location: String,
  date: String,
  album: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
struct ExifData {
  date: String,
  location: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct PhotoInfo {
  filename: String,
  path: String,
  exif: ExifData,
}

// Extract EXIF data from image
fn extract_exif_data(file_path: &str) -> ExifData {
  let mut exif_data = ExifData::default();
  
  if let Ok(file) = fs::File::open(file_path) {
    let mut bufreader = BufReader::new(&file);
    if let Ok(exifreader) = exif::Reader::new().read_from_container(&mut bufreader) {
      // Extract date - try DateTimeOriginal first (when photo was taken), then DateTime
      let date_field = exifreader.get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)
        .or_else(|| exifreader.get_field(exif::Tag::DateTime, exif::In::PRIMARY));
      
      if let Some(field) = date_field {
        let datetime_str = field.display_value().to_string();
        println!("Found EXIF DateTime: {}", datetime_str);
        
        // DateTime format is typically "YYYY:MM:DD HH:MM:SS"
        if let Some(date_part) = datetime_str.split(' ').next() {
          let parts: Vec<&str> = date_part.split(':').collect();
          if parts.len() == 3 {
            // Convert YYYY:MM:DD to YYYY-MM-DD
            exif_data.date = format!("{}-{}-{}", parts[0], parts[1], parts[2]);
            println!("Converted date: {}", exif_data.date);
          }
        }
      }
      
      // Extract GPS location if available
      if let Some(lat_field) = exifreader.get_field(exif::Tag::GPSLatitude, exif::In::PRIMARY) {
        if let Some(lon_field) = exifreader.get_field(exif::Tag::GPSLongitude, exif::In::PRIMARY) {
          let lat = lat_field.display_value().to_string();
          let lon = lon_field.display_value().to_string();
          exif_data.location = format!("{}, {}", lat, lon);
          println!("Found GPS location: {}", exif_data.location);
        }
      }
    } else {
      println!("No EXIF data found in: {}", file_path);
    }
  } else {
    println!("Failed to open file: {}", file_path);
  }
  
  exif_data
}

// Optimize image: resize and compress for web
fn optimize_image(source: &Path, dest: &Path, max_dimension: u32, quality: u8) -> Result<(), String> {
  // Load the image
  let img = image::open(source).map_err(|e| format!("Failed to open image: {}", e))?;
  
  let (width, height) = img.dimensions();
  
  // Resize if image is larger than max_dimension
  let resized = if width > max_dimension || height > max_dimension {
    let scale = if width > height {
      max_dimension as f32 / width as f32
    } else {
      max_dimension as f32 / height as f32
    };
    
    let new_width = (width as f32 * scale) as u32;
    let new_height = (height as f32 * scale) as u32;
    
    println!("Resizing {}x{} -> {}x{}", width, height, new_width, new_height);
    img.resize(new_width, new_height, FilterType::Lanczos3)
  } else {
    img
  };
  
  // Save as JPEG with specified quality
  let output_file = fs::File::create(dest).map_err(|e| format!("Failed to create output file: {}", e))?;
  let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(output_file, quality);
  
  encoder.encode(
    resized.as_bytes(),
    resized.width(),
    resized.height(),
    resized.color(),
  ).map_err(|e| format!("Failed to encode JPEG: {}", e))?;
  
  Ok(())
}

fn web_filename(filename: &str) -> String {
  let stem = Path::new(filename)
    .file_stem()
    .and_then(|value| value.to_str())
    .unwrap_or("photo");
  format!("{}.jpg", stem)
}

// Scan folder for images
#[tauri::command]
fn scan_photos(folder_path: String) -> Result<Vec<PhotoInfo>, String> {
  let mut photos = Vec::new();
  let path = PathBuf::from(&folder_path);

  if !path.is_dir() {
    return Err("Path is not a directory".to_string());
  }

  let valid_extensions = ["jpg", "jpeg", "png", "webp", "gif"];

  for entry in WalkDir::new(&path)
    .into_iter()
    .filter_map(|e| e.ok())
    .filter(|e| e.file_type().is_file())
  {
    let file_path = entry.path();
    let ext = file_path
      .extension()
      .and_then(|e| e.to_str())
      .unwrap_or("")
      .to_lowercase();

    if valid_extensions.contains(&ext.as_str()) {
      let filename = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
      
      let path_str = file_path.to_string_lossy().to_string();
      let exif = extract_exif_data(&path_str);

      photos.push(PhotoInfo {
        filename: filename.clone(),
        path: path_str,
        exif,
      });
    }
  }

  Ok(photos)
}

// Create album folder structure and save JSON
#[tauri::command]
fn create_album(
  photos: Vec<PhotoMetadata>,
  album_name: String,
  output_base: String,
) -> Result<String, String> {
  let output_path = Path::new(&output_base);

  // Normalize album name: lowercase, replace spaces with hyphens
  let normalized_album_name = album_name
    .to_lowercase()
    .replace(' ', "-")
    .replace(|c: char| !c.is_alphanumeric() && c != '-', "-");

  // Create album folder
  let album_folder = output_path.join(&normalized_album_name);
  fs::create_dir_all(&album_folder).map_err(|e| e.to_string())?;

  // Optimize and copy photos to album folder (in parallel)
  // Max dimension: 2000px, JPEG quality: 85
  let results: Vec<Result<(), String>> = photos
    .par_iter()
    .map(|photo| {
      let source = Path::new(&photo.path);
      let dest = album_folder.join(web_filename(&photo.filename));

      if source.exists() {
        optimize_image(source, &dest, 2000, 85)
          .map_err(|e| format!("Failed to optimize {}: {}", photo.filename, e))?;
        println!("Optimized: {}", photo.filename);
        Ok(())
      } else {
        Ok(())
      }
    })
    .collect();

  // Check for any errors during parallel processing
  for result in results {
    result?;
  }

  // Path to metadata file: assets/data/albums.meta.json
  // Assuming output_base is assets/images/albums, we go up 2 levels to assets, then data/
  let meta_file = output_path
    .parent()
    .and_then(|p| p.parent())
    .map(|p| p.join("data").join("albums.meta.json"))
    .ok_or("Invalid output path structure")?;

  // Read existing metadata or create empty object
  let mut metadata: serde_json::Value = if meta_file.exists() {
    let content = fs::read_to_string(&meta_file).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
  } else {
    serde_json::json!({})
  };

  // Add new photos to metadata
  for photo in &photos {
    let output_filename = web_filename(&photo.filename);
    let key = format!("{}/{}", normalized_album_name, output_filename);
    metadata[key] = serde_json::json!({
      "title": photo.title,
      "tags": photo.tags,
      "location": photo.location,
      "date": photo.date,
      "album": normalized_album_name
    });
  }

  // Save updated metadata
  fs::create_dir_all(meta_file.parent().unwrap()).map_err(|e| e.to_string())?;
  let json_string = serde_json::to_string_pretty(&metadata).map_err(|e| e.to_string())?;
  fs::write(&meta_file, json_string).map_err(|e| e.to_string())?;

  Ok(format!(
    "Album created successfully!\nAlbum: {}\nPhotos: {}\nMetadata saved to: {}",
    normalized_album_name,
    photos.len(),
    meta_file.display()
  ))
}

// Get filename without extension
#[tauri::command]
fn sanitize_filename(filename: String) -> String {
  filename
    .split('.')
    .next()
    .unwrap_or(&filename)
    .replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "-")
    .to_lowercase()
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      scan_photos,
      create_album,
      sanitize_filename
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
