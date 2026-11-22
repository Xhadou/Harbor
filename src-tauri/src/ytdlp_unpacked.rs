//! On macOS the official single-file yt-dlp unpacks itself, about 37 MB, into a temporary
//! directory every time it starts: 4.9 s before it does anything, against 0.2 s for the same
//! release shipped as a folder that is already unpacked. A trailer lookup measured 6.0 s with
//! the one and 1.8 s with the other.
//!
//! This keeps that folder beside the single file. It is made from the release's own archive,
//! which must match the official checksum, and the whole folder is checked again before every
//! use, as the single file is.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::{Component, Path, PathBuf};

pub(crate) const ARCHIVE: &str = "yt-dlp_macos.zip";
pub(crate) const MAX_ARCHIVE: usize = 160 * 1024 * 1024;
const EXECUTABLE: &str = "yt-dlp_macos";
const SINGLE_FILE_SUFFIX: &str = "-yt-dlp_macos";
const FOLDER_SUFFIX: &str = "-yt-dlp_macos.dir";
const SEAL_SUFFIX: &str = "-yt-dlp_macos.seal.json";
const MAX_UNPACKED: u64 = 640 * 1024 * 1024;
const MAX_ENTRIES: usize = 4096;
const MAX_SEAL: u64 = 4096;

/// What the folder held when it was made, and the archive it was made from.
#[derive(Deserialize, Serialize)]
struct Seal {
    version: String,
    archive_sha256: String,
    tree_sha256: String,
}

fn folder(directory: &Path, version: &str) -> PathBuf {
    directory.join(format!("{version}{FOLDER_SUFFIX}"))
}

fn seal_path(directory: &Path, version: &str) -> PathBuf {
    directory.join(format!("{version}{SEAL_SUFFIX}"))
}

/// The release a verified single file is, read from its name: `2026.08.19-yt-dlp_macos`.
pub(crate) fn version_of(single_file: &Path) -> Option<&str> {
    single_file
        .file_name()?
        .to_str()?
        .strip_suffix(SINGLE_FILE_SUFFIX)
        .filter(|version| !version.is_empty())
}

/// One digest over every file under `root`: each one's path, length and bytes, in name order.
/// A folder holding anything but plain files and directories has none.
fn tree_digest(root: &Path) -> Option<String> {
    let mut hasher = Sha256::new();
    let mut total = 0u64;
    let mut count = 0usize;
    for entry in walkdir::WalkDir::new(root)
        .follow_links(false)
        .sort_by_file_name()
    {
        let entry = entry.ok()?;
        let kind = entry.file_type();
        if kind.is_dir() {
            continue;
        }
        if !kind.is_file() {
            return None;
        }
        count += 1;
        if count > MAX_ENTRIES {
            return None;
        }
        let relative = entry.path().strip_prefix(root).ok()?.to_str()?;
        let mut file = std::fs::File::open(entry.path()).ok()?;
        let length = file.metadata().ok()?.len();
        total = total.checked_add(length)?;
        if total > MAX_UNPACKED {
            return None;
        }
        hasher.update((relative.len() as u64).to_be_bytes());
        hasher.update(relative.as_bytes());
        hasher.update(length.to_be_bytes());
        std::io::copy(&mut file, &mut hasher).ok()?;
    }
    (count > 0).then(|| format!("{:x}", hasher.finalize()))
}

/// Unpacks the archive into `destination`. Every entry must be a plain file or a directory
/// that stays inside it: no link, no path that climbs out.
fn unpack(archive: &[u8], destination: &Path) -> Result<(), ()> {
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(archive)).map_err(|_| ())?;
    if zip.len() > MAX_ENTRIES {
        return Err(());
    }
    let mut total = 0u64;
    for index in 0..zip.len() {
        let mut entry = zip.by_index(index).map_err(|_| ())?;
        let relative = entry.enclosed_name().ok_or(())?;
        if relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
        {
            return Err(());
        }
        let target = destination.join(&relative);
        if entry.is_dir() {
            std::fs::create_dir_all(&target).map_err(|_| ())?;
            continue;
        }
        let mode = entry.unix_mode().unwrap_or(0o100644);
        let kind = mode & 0o170000;
        if kind != 0o100000 && kind != 0 {
            return Err(());
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|_| ())?;
        }
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
            .map_err(|_| ())?;
        let room = MAX_UNPACKED.saturating_sub(total);
        let written = std::io::copy(&mut (&mut entry).take(room + 1), &mut file).map_err(|_| ())?;
        total += written;
        if total > MAX_UNPACKED {
            return Err(());
        }
        drop(file);
        use std::os::unix::fs::PermissionsExt;
        let permissions = if mode & 0o111 != 0 { 0o755 } else { 0o644 };
        std::fs::set_permissions(&target, std::fs::Permissions::from_mode(permissions))
            .map_err(|_| ())?;
    }
    Ok(())
}

fn verified(directory: &Path, version: &str) -> Option<PathBuf> {
    let path = seal_path(directory, version);
    if std::fs::metadata(&path).ok()?.len() > MAX_SEAL {
        return None;
    }
    let seal: Seal = serde_json::from_slice(&std::fs::read(&path).ok()?).ok()?;
    if seal.version != version {
        return None;
    }
    let root = folder(directory, version);
    let executable = root.join(EXECUTABLE);
    if !std::fs::symlink_metadata(&executable).ok()?.is_file() {
        return None;
    }
    (tree_digest(&root)? == seal.tree_sha256).then_some(executable)
}

/// The unpacked yt-dlp of this release, if it is here and still what it was when it was made.
pub(crate) async fn verified_executable(directory: &Path, version: &str) -> Option<PathBuf> {
    let directory = directory.to_path_buf();
    let version = version.to_string();
    tokio::task::spawn_blocking(move || verified(&directory, &version))
        .await
        .ok()?
}

struct Staging(PathBuf);
impl Drop for Staging {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn install_blocking(
    directory: &Path,
    version: &str,
    archive: &[u8],
    archive_sha256: &str,
) -> Result<PathBuf, ()> {
    let digest = format!("{:x}", Sha256::digest(archive));
    if archive_sha256.len() != 64 || !digest.eq_ignore_ascii_case(archive_sha256) {
        return Err(());
    }
    std::fs::create_dir_all(directory).map_err(|_| ())?;
    let staging = Staging(directory.join(format!(
        "{version}-yt-dlp_macos.{}.part",
        uuid::Uuid::new_v4()
    )));
    unpack(archive, &staging.0)?;
    if !std::fs::symlink_metadata(staging.0.join(EXECUTABLE))
        .map_err(|_| ())?
        .is_file()
    {
        return Err(());
    }
    let tree_sha256 = tree_digest(&staging.0).ok_or(())?;
    let root = folder(directory, version);
    // The seal goes first: a folder without its seal is never used.
    let seal = seal_path(directory, version);
    let _ = std::fs::remove_file(&seal);
    let _ = std::fs::remove_dir_all(&root);
    std::fs::rename(&staging.0, &root).map_err(|_| ())?;
    let body = serde_json::to_vec(&Seal {
        version: version.to_string(),
        archive_sha256: digest,
        tree_sha256,
    })
    .map_err(|_| ())?;
    let partial = seal.with_extension(format!("{}.part", uuid::Uuid::new_v4()));
    std::fs::write(&partial, body).map_err(|_| ())?;
    std::fs::rename(&partial, &seal).map_err(|_| ())?;
    remove_other_releases(directory, version);
    Ok(root.join(EXECUTABLE))
}

/// A release that is no longer the one in use leaves its folder and seal behind.
fn remove_other_releases(directory: &Path, version: &str) {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if let Some(other) = name.strip_suffix(FOLDER_SUFFIX) {
            if other != version {
                let _ = std::fs::remove_dir_all(entry.path());
            }
        } else if let Some(other) = name.strip_suffix(SEAL_SUFFIX) {
            if other != version {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
}

/// Makes the unpacked folder from the release's archive, which must match `archive_sha256`,
/// the digest the release's own checksum list gives for it.
pub(crate) async fn install(
    directory: &Path,
    version: &str,
    archive: Vec<u8>,
    archive_sha256: &str,
) -> Result<PathBuf, ()> {
    let directory = directory.to_path_buf();
    let version = version.to_string();
    let archive_sha256 = archive_sha256.to_string();
    tokio::task::spawn_blocking(move || {
        install_blocking(&directory, &version, &archive, &archive_sha256)
    })
    .await
    .map_err(|_| ())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    const VERSION: &str = "2026.08.19";

    fn home() -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("harbor-ytdlp-unpacked-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&path).unwrap();
        path
    }

    fn archive(entries: &[(&str, &[u8], u32)]) -> Vec<u8> {
        let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        for (name, bytes, mode) in entries {
            let options = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored)
                .unix_permissions(*mode);
            zip.start_file(*name, options).unwrap();
            zip.write_all(bytes).unwrap();
        }
        zip.finish().unwrap().into_inner()
    }

    fn release() -> Vec<u8> {
        archive(&[
            ("yt-dlp_macos", b"launcher", 0o755),
            ("_internal/lib/python.dylib", b"library", 0o644),
        ])
    }

    fn sha(bytes: &[u8]) -> String {
        format!("{:x}", Sha256::digest(bytes))
    }

    #[test]
    fn the_release_is_read_from_the_single_files_name() {
        assert_eq!(
            version_of(Path::new("/c/2026.08.19-yt-dlp_macos")),
            Some(VERSION)
        );
        assert_eq!(version_of(Path::new("/c/-yt-dlp_macos")), None);
        assert_eq!(version_of(Path::new("/c/2026.08.19-yt-dlp_linux")), None);
    }

    #[test]
    fn an_archive_that_matches_its_checksum_is_unpacked_and_usable() {
        let home = home();
        let bytes = release();
        let executable = install_blocking(&home, VERSION, &bytes, &sha(&bytes)).unwrap();
        assert_eq!(
            executable,
            home.join("2026.08.19-yt-dlp_macos.dir/yt-dlp_macos")
        );
        assert_eq!(std::fs::read(&executable).unwrap(), b"launcher");
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(
            std::fs::metadata(&executable).unwrap().permissions().mode() & 0o777,
            0o755
        );
        assert_eq!(verified(&home, VERSION), Some(executable));
        std::fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn an_archive_that_does_not_match_its_checksum_leaves_nothing() {
        let home = home();
        let bytes = release();
        assert!(install_blocking(&home, VERSION, &bytes, &sha(b"something else")).is_err());
        assert_eq!(verified(&home, VERSION), None);
        assert_eq!(std::fs::read_dir(&home).unwrap().count(), 0);
        std::fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn a_folder_changed_after_it_was_made_is_not_used() {
        let home = home();
        let bytes = release();
        let executable = install_blocking(&home, VERSION, &bytes, &sha(&bytes)).unwrap();
        let root = executable.parent().unwrap().to_path_buf();

        std::fs::write(root.join("_internal/lib/python.dylib"), b"LIBRARY").unwrap();
        assert_eq!(verified(&home, VERSION), None, "a changed file");
        std::fs::write(root.join("_internal/lib/python.dylib"), b"library").unwrap();
        assert!(verified(&home, VERSION).is_some(), "put back");

        std::fs::write(root.join("_internal/extra.py"), b"x").unwrap();
        assert_eq!(verified(&home, VERSION), None, "an added file");
        std::fs::remove_file(root.join("_internal/extra.py")).unwrap();

        std::os::unix::fs::symlink("/usr/bin/true", root.join("_internal/link")).unwrap();
        assert_eq!(verified(&home, VERSION), None, "a link");
        std::fs::remove_file(root.join("_internal/link")).unwrap();

        std::fs::remove_file(seal_path(&home, VERSION)).unwrap();
        assert_eq!(verified(&home, VERSION), None, "no seal");
        std::fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn a_seal_for_another_release_is_not_this_releases() {
        let home = home();
        let bytes = release();
        install_blocking(&home, VERSION, &bytes, &sha(&bytes)).unwrap();
        assert_eq!(verified(&home, "2026.10.26"), None);
        std::fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn an_archive_may_not_write_outside_its_folder_or_carry_a_link() {
        let home = home();
        let climbing = archive(&[
            ("yt-dlp_macos", b"launcher", 0o755),
            ("../escaped", b"x", 0o644),
        ]);
        assert!(install_blocking(&home, VERSION, &climbing, &sha(&climbing)).is_err());
        assert!(!home.parent().unwrap().join("escaped").exists());

        let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        let options = zip::write::SimpleFileOptions::default();
        zip.start_file("yt-dlp_macos", options.unix_permissions(0o755))
            .unwrap();
        zip.write_all(b"launcher").unwrap();
        zip.add_symlink("_internal/link", "/usr/bin/true", options)
            .unwrap();
        let linked = zip.finish().unwrap().into_inner();
        assert!(install_blocking(&home, VERSION, &linked, &sha(&linked)).is_err());

        let headless = archive(&[("_internal/lib/python.dylib", b"library", 0o644)]);
        assert!(install_blocking(&home, VERSION, &headless, &sha(&headless)).is_err());
        assert_eq!(
            std::fs::read_dir(&home).unwrap().count(),
            0,
            "nothing is left half made"
        );
        std::fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn a_newer_release_replaces_the_one_before() {
        let home = home();
        let bytes = release();
        install_blocking(&home, "2026.06.01", &bytes, &sha(&bytes)).unwrap();
        install_blocking(&home, VERSION, &bytes, &sha(&bytes)).unwrap();
        assert_eq!(verified(&home, "2026.06.01"), None);
        assert!(verified(&home, VERSION).is_some());
        let mut names: Vec<String> = std::fs::read_dir(&home)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .collect();
        names.sort();
        assert_eq!(
            names,
            [
                "2026.08.19-yt-dlp_macos.dir",
                "2026.08.19-yt-dlp_macos.seal.json"
            ]
        );
        std::fs::remove_dir_all(home).unwrap();
    }
}
