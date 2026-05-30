use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{App, Emitter};

pub fn setup_menu(app: &mut App) -> tauri::Result<()> {
    let add_camera = MenuItemBuilder::with_id("add-camera", "Add Camera…")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let find_cameras = MenuItemBuilder::with_id("find-cameras", "Find Cameras…").build(app)?;
    let settings = MenuItemBuilder::with_id("settings", "Settings")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;
    let import = MenuItemBuilder::with_id("import", "Import Setup…").build(app)?;
    let export = MenuItemBuilder::with_id("export", "Export Setup…").build(app)?;

    let menu = MenuBuilder::new(app);

    #[cfg(target_os = "macos")]
    let menu = {
        let app_menu = SubmenuBuilder::new(app, "Vigilante")
            .about(None)
            .separator()
            .item(&settings)
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?;
        menu.item(&app_menu)
    };

    let cameras_menu = SubmenuBuilder::new(app, "Cameras")
        .item(&add_camera)
        .item(&find_cameras)
        .separator();

    #[cfg(not(target_os = "macos"))]
    let cameras_menu = cameras_menu.item(&settings).separator();

    let cameras_menu = cameras_menu.item(&import).item(&export);

    #[cfg(not(target_os = "macos"))]
    let cameras_menu = cameras_menu
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?);

    let cameras_menu = cameras_menu.build()?;

    let menu = menu.item(&cameras_menu).build()?;
    app.set_menu(menu)?;

    app.on_menu_event(move |app, event| match event.id().as_ref() {
        "add-camera" => {
            let _ = app.emit("add-camera", ());
        }
        "find-cameras" => {
            let _ = app.emit("find-cameras", ());
        }
        "settings" => {
            let _ = app.emit("open-settings", ());
        }
        "import" => {
            let _ = app.emit("import-configuration", ());
        }
        "export" => {
            let _ = app.emit("export-configuration", ());
        }
        _ => {}
    });

    Ok(())
}
