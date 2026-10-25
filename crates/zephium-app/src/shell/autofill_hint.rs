//! Until Zephium keeps passwords itself, the system fills them through the
//! page's right-click AutoFill menu, which few people find. The first time a
//! person focuses a password field in a profile, chrome says where it is.
//! Private profiles are left out: they keep nothing, so the hint would come
//! back with every private window.

use super::*;

const KEY: &str = "notice.autofill-hint";
const MAX_PROFILES: usize = zephium_core::session::MAX_SESSION_PROFILES;

#[derive(Debug, Default)]
pub(super) struct AutofillHint {
    shown: Vec<ProfileId>,
    unsupported: bool,
}

impl AutofillHint {
    pub(super) fn load(store: &dyn zephium_core::ports::store::Store) -> Self {
        Self::parse(&store.app_setting(KEY).unwrap_or_default())
    }

    fn parse(value: &str) -> Self {
        let mut shown = Vec::new();
        for profile in value.split(',').filter_map(ProfileId::parse) {
            if shown.len() < MAX_PROFILES && !shown.contains(&profile) {
                shown.push(profile);
            }
        }
        Self {
            shown,
            unsupported: false,
        }
    }

    fn pending(&self, profile: ProfileId) -> bool {
        !self.unsupported && !self.shown.contains(&profile)
    }

    /// Records `profile` and answers the stored value. The oldest profile
    /// gives way once the list is full; a deleted profile is never asked for.
    fn mark(&mut self, profile: ProfileId) -> String {
        if self.shown.len() >= MAX_PROFILES {
            self.shown.remove(0);
        }
        self.shown.push(profile);
        self.shown
            .iter()
            .map(ProfileId::to_string)
            .collect::<Vec<_>>()
            .join(",")
    }
}

impl Shell {
    fn autofill_hint_profile(&self, id: ItemId) -> Option<ProfileId> {
        self.items.tab(id)?;
        let profile = self.profile_of_item(id)?;
        let kept = self
            .profiles
            .get(profile)
            .is_some_and(|known| known.kind != ProfileKind::Incognito);
        (kept && self.autofill_hint.pending(profile)).then_some(profile)
    }

    /// Asks the committed document of `id` to say when a password field
    /// first takes focus, while its profile has not had the hint.
    pub(super) fn maybe_watch_password_focus(&mut self, id: ItemId) {
        if self.autofill_hint_profile(id).is_none() {
            return;
        }
        if self.engine.watch_password_focus(id) == NativeDispatch::Unsupported {
            self.autofill_hint.unsupported = true;
        }
    }

    pub(super) fn on_password_field_focused(&mut self, id: ItemId) {
        let Some(profile) = self.autofill_hint_profile(id) else {
            return;
        };
        let value = self.autofill_hint.mark(profile);
        // A write that did not land only means the hint comes once more.
        let _ = self.store.set_app_setting(KEY.into(), value);
        (self.emit)(Projection::UiCommand("autofill.hint".into()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_stored_list_keeps_only_distinct_profiles_within_the_bound() {
        let one = ProfileId::generate();
        let two = ProfileId::generate();
        let hint = AutofillHint::parse(&format!("{one},junk,,{two},{one}"));
        assert_eq!(hint.shown, vec![one, two]);
        assert!(!hint.pending(one));
        assert!(hint.pending(ProfileId::generate()));

        let many: Vec<String> = (0..MAX_PROFILES + 3)
            .map(|_| ProfileId::generate().to_string())
            .collect();
        assert_eq!(
            AutofillHint::parse(&many.join(",")).shown.len(),
            MAX_PROFILES
        );
    }

    #[test]
    fn marking_a_full_list_drops_the_oldest() {
        let mut hint = AutofillHint::default();
        let first = ProfileId::generate();
        hint.mark(first);
        for _ in 1..MAX_PROFILES {
            hint.mark(ProfileId::generate());
        }
        let last = ProfileId::generate();
        let stored = hint.mark(last);
        assert_eq!(hint.shown.len(), MAX_PROFILES);
        assert!(hint.pending(first));
        assert!(!hint.pending(last));
        assert_eq!(AutofillHint::parse(&stored).shown, hint.shown);
    }
}
