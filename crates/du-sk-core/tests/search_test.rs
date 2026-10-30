use du_sk_core::{FileNode, SearchIndex};
use std::sync::atomic::AtomicU64;
use std::time::Instant;

fn build_fixture_tree() -> FileNode {
    let mut root = FileNode::new_dir("root");

    let mut docs = FileNode::new_dir("Documents");
    docs.children
        .push(FileNode::new_file("resume.pdf", 500_000));
    docs.children
        .push(FileNode::new_file("report.PDF", 1_500_000));
    docs.children.push(FileNode::new_file("notes.txt", 10_000));

    let mut sub_proj = FileNode::new_dir("Project");
    sub_proj
        .children
        .push(FileNode::new_file("project_plan.pdf", 2_000_000));
    sub_proj
        .children
        .push(FileNode::new_file("café_receipt.png", 300_000));
    docs.children.push(sub_proj);

    let mut downloads = FileNode::new_dir("Downloads");
    downloads
        .children
        .push(FileNode::new_file("archive.tar.gz", 50_000_000));
    downloads
        .children
        .push(FileNode::new_file("pdf_reader.dmg", 25_000_000));

    root.children.push(docs);
    root.children.push(downloads);
    root.children.push(FileNode::new_file("pdf", 100));

    root.roll_up_sizes();
    root
}

#[test]
fn test_search_empty_and_whitespace_query() {
    let root = build_fixture_tree();
    let base = vec!["root".to_string()];

    assert!(root.search_subtree(&base, "", 10).is_empty());
    assert!(root.search_subtree(&base, "   ", 10).is_empty());
    assert!(root.search_subtree(&base, "pdf", 0).is_empty());
}

#[test]
fn test_case_insensitivity_and_unicode() {
    let root = build_fixture_tree();
    let base = vec!["root".to_string()];

    let res_pdf = root.search_subtree(&base, "pdf", 10);
    let names: Vec<&str> = res_pdf.iter().map(|i| i.name.as_str()).collect();
    assert!(names.contains(&"resume.pdf"));
    assert!(names.contains(&"report.PDF"));
    assert!(names.contains(&"pdf_reader.dmg"));
    assert!(names.contains(&"project_plan.pdf"));
    assert!(names.contains(&"pdf"));

    let res_cafe = root.search_subtree(&base, "CAFÉ", 10);
    assert_eq!(res_cafe.len(), 1);
    assert_eq!(res_cafe[0].name, "café_receipt.png");
}

#[test]
fn test_scope_isolation() {
    let root = build_fixture_tree();
    let docs = root.find_node_by_path(&["root", "Documents"]).unwrap();
    let base = vec!["root".to_string(), "Documents".to_string()];

    let res = docs.search_subtree(&base, "pdf", 10);
    let names: Vec<&str> = res.iter().map(|i| i.name.as_str()).collect();

    assert!(names.contains(&"resume.pdf"));
    assert!(names.contains(&"report.PDF"));
    assert!(names.contains(&"project_plan.pdf"));
    assert!(!names.contains(&"pdf_reader.dmg"));
    assert!(!names.contains(&"pdf"));

    for item in &res {
        assert!(item.path_segments.starts_with(&base));
    }
}

#[test]
fn test_ranking_tiers_and_size_ordering() {
    let root = build_fixture_tree();
    let base = vec!["root".to_string()];

    let res = root.search_subtree(&base, "pdf", 10);
    assert_eq!(res[0].name, "pdf");
    assert_eq!(res[1].name, "pdf_reader.dmg");

    let remaining = &res[2..];
    for pair in remaining.windows(2) {
        assert!(pair[0].size >= pair[1].size);
    }
}

#[test]
fn test_relative_paths() {
    let root = build_fixture_tree();
    let base = vec!["root".to_string()];

    let res = root.search_subtree(&base, "café_receipt.png", 1);
    assert_eq!(res.len(), 1);
    assert_eq!(res[0].relative_path, "Documents/Project/café_receipt.png");
    assert_eq!(
        res[0].path_segments,
        vec!["root", "Documents", "Project", "café_receipt.png"]
    );
}

#[test]
fn test_index_resolves_nested_base_path() {
    let root = build_fixture_tree();
    let index = SearchIndex::build(&root, "/tmp/root");
    let latest = AtomicU64::new(1);
    let base = vec!["root".to_string(), "Documents".to_string()];

    let res = index.search(&base, "pdf", 10, &latest, 1).unwrap();
    let names: Vec<&str> = res.iter().map(|i| i.name.as_str()).collect();

    assert!(names.contains(&"resume.pdf"));
    assert!(!names.contains(&"pdf_reader.dmg"));
    assert!(!names.contains(&"pdf"));
}

#[test]
fn test_stale_request_is_cancelled() {
    let root = build_fixture_tree();
    let index = SearchIndex::build(&root, "/tmp/root");
    let latest = AtomicU64::new(2);
    let base = vec!["root".to_string()];

    assert!(index.search(&base, "pdf", 10, &latest, 1).is_none());
}

#[test]
fn test_benchmark_large_tree_traversal() {
    let mut root = FileNode::new_dir("benchmark_root");

    let branches = 20;
    let sub_branches = 50;
    let files_per_leaf = 250;

    for b in 0..branches {
        let mut b_dir = FileNode::new_dir(&format!("dir_{}", b));
        for sb in 0..sub_branches {
            let mut sb_dir = FileNode::new_dir(&format!("sub_{}_{}", b, sb));
            for f in 0..files_per_leaf {
                let name = if f == 42 {
                    format!("target_match_{}_{}.log", b, sb)
                } else {
                    format!("data_chunk_{}_{}_{}.bin", b, sb, f)
                };
                sb_dir
                    .children
                    .push(FileNode::new_file(&name, (f as u64 + 1) * 1024));
            }
            b_dir.children.push(sb_dir);
        }
        root.children.push(b_dir);
    }

    root.roll_up_sizes();

    let index = SearchIndex::build(&root, "/tmp/benchmark_root");
    let latest = AtomicU64::new(1);
    let base = vec!["benchmark_root".to_string()];

    let start = Instant::now();
    let matches = index.search(&base, "target_match", 50, &latest, 1).unwrap();
    let elapsed = start.elapsed();

    assert_eq!(matches.len(), 50);
    assert!(
        elapsed.as_millis() < 50,
        "Search took too long: {:?}",
        elapsed
    );
}
