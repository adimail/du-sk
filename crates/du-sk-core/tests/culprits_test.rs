use du_sk_core::{find_top_culprits, FileNode};

#[test]
fn test_culprits_empty_root() {
    let root = FileNode::new_dir("root");
    let culprits = find_top_culprits(&root, 0, 5);
    assert!(culprits.is_empty());
}

#[test]
fn test_culprits_flat_files_only() {
    let mut root = FileNode::new_dir("root");
    root.children
        .push(FileNode::new_file("file1.iso", 50_000_000));
    root.children
        .push(FileNode::new_file("file2.iso", 50_000_000));
    root.roll_up_sizes();

    let culprits = find_top_culprits(&root, root.size, 5);
    assert!(culprits.is_empty());
}

#[test]
fn test_culprits_filters_micro_folders() {
    let mut root = FileNode::new_dir("root");

    let mut large = FileNode::new_dir("target");
    large
        .children
        .push(FileNode::new_file("large.bin", 500_000_000));

    let mut tiny = FileNode::new_dir("dist");
    tiny.children.push(FileNode::new_file("small.js", 280_000));

    root.children.push(large);
    root.children.push(tiny);
    root.roll_up_sizes();

    let culprits = find_top_culprits(&root, root.size, 5);
    assert_eq!(culprits.len(), 1);
    assert_eq!(culprits[0].name, "target");
}

#[test]
fn test_culprits_drills_through_containers_and_stops_at_terminal_boundaries() {
    let mut root = FileNode::new_dir("du-sk");

    let mut target = FileNode::new_dir("target");
    let mut debug = FileNode::new_dir("debug");
    let mut deps = FileNode::new_dir("deps");
    deps.children
        .push(FileNode::new_file("app.bin", 6_000_000_000));
    debug.children.push(deps);
    target.children.push(debug);

    let mut src_tauri = FileNode::new_dir("src-tauri");
    let mut st_target = FileNode::new_dir("target");
    st_target
        .children
        .push(FileNode::new_file("lib.dylib", 2_000_000_000));
    src_tauri.children.push(st_target);

    let mut node_modules = FileNode::new_dir("node_modules");
    node_modules
        .children
        .push(FileNode::new_file("pkg.js", 100_000_000));

    root.children.push(target);
    root.children.push(src_tauri);
    root.children.push(node_modules);
    root.roll_up_sizes();

    let culprits = find_top_culprits(&root, root.size, 5);

    assert_eq!(culprits.len(), 3);
    assert_eq!(culprits[0].name, "target");
    assert_eq!(culprits[0].relative_path, "target");

    assert_eq!(culprits[1].name, "target");
    assert_eq!(culprits[1].relative_path, "src-tauri/target");

    assert_eq!(culprits[2].name, "node_modules");
    assert_eq!(culprits[2].relative_path, "node_modules");
}

#[test]
fn test_culprits_respects_limit() {
    let mut root = FileNode::new_dir("root");

    for i in 1..=10 {
        let mut d = FileNode::new_dir(&format!("dir_{}", i));
        d.children
            .push(FileNode::new_file("f", (i as u64) * 20_000_000));
        root.children.push(d);
    }
    root.roll_up_sizes();

    let culprits = find_top_culprits(&root, root.size, 3);
    assert_eq!(culprits.len(), 3);
    assert_eq!(culprits[0].name, "dir_10");
    assert_eq!(culprits[1].name, "dir_9");
    assert_eq!(culprits[2].name, "dir_8");
}
