//! Tells the shell when the person first focuses a password field, so it can
//! point them to WebKit's AutoFill. One host-initiated evaluation per
//! committed document waits in its own isolated world; nothing is polled and
//! the page has no way to call the host.
use super::EngineHost;
use zephium_core::ids::ItemId;
use zephium_core::navigation as navigation_policy;
use zephium_core::ports::engine::EngineEvent;

const SCRIPT: &str = include_str!("../platform/password_focus.js");

pub(super) fn expression(page_url: &str) -> String {
    let page = serde_json::to_string(page_url).expect("a string is serializable");
    format!("({SCRIPT})({page})")
}

impl EngineHost {
    pub(crate) fn watch_password_focus(&mut self, id: ItemId) {
        let Some(view) = self.views.get(&id) else {
            return;
        };
        let Some((epoch, page_url)) = view.navigation.committed_snapshot() else {
            return;
        };
        if !navigation_policy::is_allowed_str(&page_url) {
            return;
        }
        let script = expression(&page_url);
        crate::platform::imp::password_focus::watch(&view.view, &script, move |focused| {
            if !focused {
                return;
            }
            let _ = crate::host::try_with(move |host| {
                let Some(view) = host.views.get(&id) else {
                    return;
                };
                if view.navigation.matches_committed_snapshot(epoch, &page_url) {
                    view.event_permit
                        .emit(&host.sink, EngineEvent::PasswordFieldFocused { id });
                }
            });
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_watch_names_its_page_as_a_literal() {
        let script = expression("https://example.com/a\"b");
        assert!(script.ends_with(r#")("https://example.com/a\"b")"#));
    }

    #[test]
    fn the_watch_reads_no_field_value_and_keeps_no_timer() {
        for forbidden in [
            ".value",
            "setTimeout",
            "setInterval",
            "postMessage",
            "webkit.messageHandlers",
        ] {
            assert!(!SCRIPT.contains(forbidden), "{forbidden}");
        }
    }

    #[test]
    fn the_watch_answers_only_trusted_input_and_cleans_up() {
        assert_eq!(SCRIPT.matches("event.isTrusted").count(), 3);
        assert!(SCRIPT.contains("removeEventListener(type, listener, true)"));
        assert!(SCRIPT.contains("earlier(null)"));
        assert!(SCRIPT.contains("location.href !== page"));
    }

    #[test]
    fn the_watch_enters_only_frames_it_may_read() {
        assert!(SCRIPT.contains("frame.contentDocument"));
        assert!(!SCRIPT.contains("contentWindow"));
        assert!(SCRIPT.contains("MAX_DOCUMENTS = 16"));
    }
}
