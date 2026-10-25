use super::*;

type Hints = Arc<Mutex<Vec<String>>>;

fn hinted(store: Arc<FakeStore>, supported: bool) -> (Shell, Arc<FakeEngine>, Screen, Hints) {
    let engine = Arc::new(FakeEngine::default());
    engine
        .watches_password_focus
        .store(supported, std::sync::atomic::Ordering::Release);
    let screen: Screen = Arc::new(Mutex::new(ItemsState {
        projection_revision: String::new(),
        profile: None,
        spaces: Vec::new(),
        active_space_id: None,
        nodes: Vec::new(),
        tabs: Vec::new(),
        active: None,
        split_group: None,
    }));
    let hints: Hints = Arc::new(Mutex::new(Vec::new()));
    let (sink, said) = (screen.clone(), hints.clone());
    let mut shell = Shell::new_with_failure(
        engine.clone(),
        store,
        Arc::new(ImmediateAllowAllCompiler),
        Box::new(|_| {}),
        Arc::new(FakeChrome),
        Box::new(move |p| {
            if let Projection::UiCommand(id) = &p {
                said.lock().unwrap().push(id.clone());
            }
            apply_projection(&mut sink.lock().unwrap(), p)
        }),
    );
    shell.handle(Command::SetWindowSize(Size::new(1200.0, 800.0)));
    shell.handle(Command::Bootstrap);
    (shell, engine, screen, hints)
}

fn watches(engine: &FakeEngine) -> Vec<ItemId> {
    engine.password_watches.lock().unwrap().clone()
}

fn autofill_hints(hints: &Hints) -> usize {
    hints
        .lock()
        .unwrap()
        .iter()
        .filter(|id| *id == "autofill.hint")
        .count()
}

fn focus_password(shell: &mut Shell, id: ItemId) {
    shell.handle(Command::Engine(EngineEvent::PasswordFieldFocused { id }));
}

#[test]
fn the_first_password_focus_in_a_profile_hints_once() {
    let store = Arc::new(FakeStore::default());
    let (mut shell, engine, screen, hints) = hinted(store.clone(), true);
    let tab = active_id(&screen);
    commit_url(&mut shell, tab, "https://login.example/");
    assert_eq!(watches(&engine), vec![tab]);

    focus_password(&mut shell, tab);
    assert_eq!(autofill_hints(&hints), 1);
    let profile = shell.windows.focused().unwrap().profile;
    assert_eq!(
        store.app_setting("notice.autofill-hint"),
        Some(profile.to_string())
    );

    focus_password(&mut shell, tab);
    commit_url(&mut shell, tab, "https://other.example/");
    assert_eq!(autofill_hints(&hints), 1);
    assert_eq!(watches(&engine), vec![tab]);
}

#[test]
fn a_profile_that_had_the_hint_is_not_watched_again() {
    let store = Arc::new(FakeStore::default());
    let (mut shell, _engine, screen, _hints) = hinted(store.clone(), true);
    let tab = active_id(&screen);
    commit_url(&mut shell, tab, "https://login.example/");
    focus_password(&mut shell, tab);

    let (mut restarted, engine, screen, hints) = hinted(store, true);
    let tab = active_id(&screen);
    commit_url(&mut restarted, tab, "https://login.example/");
    focus_password(&mut restarted, tab);
    assert!(watches(&engine).is_empty());
    assert_eq!(autofill_hints(&hints), 0);
}

#[test]
fn private_windows_are_never_watched_or_hinted() {
    let (mut shell, engine, screen, hints) = hinted(Arc::new(FakeStore::default()), true);
    shell.handle(Command::Run("window.newPrivate".into()));
    let private = active_id(&screen);
    assert!(shell.incognito_profile(shell.windows.focused().unwrap().profile));
    commit_url(&mut shell, private, "https://login.example/");
    focus_password(&mut shell, private);
    assert!(watches(&engine).is_empty());
    assert_eq!(autofill_hints(&hints), 0);
}

#[test]
fn an_engine_without_the_watch_is_asked_once() {
    let (mut shell, engine, screen, hints) = hinted(Arc::new(FakeStore::default()), false);
    let tab = active_id(&screen);
    commit_url(&mut shell, tab, "https://login.example/");
    engine
        .watches_password_focus
        .store(true, std::sync::atomic::Ordering::Release);
    commit_url(&mut shell, tab, "https://other.example/");
    assert!(watches(&engine).is_empty());
    focus_password(&mut shell, tab);
    assert_eq!(autofill_hints(&hints), 0);
}
