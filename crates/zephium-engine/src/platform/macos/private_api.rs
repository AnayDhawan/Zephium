//! WebKit's private selectors Zephium relies on. Each use is guarded by
//! `respondsToSelector:` and degrades to a feature that is unavailable, so a
//! release of macOS that drops one is silent. This names which are gone.

use std::ffi::CStr;

use objc2::ffi::protocol_getMethodDescription;
use objc2::runtime::{AnyClass, AnyProtocol, Bool, Sel};

/// Selectors WebKit implements on its own classes.
const IMPLEMENTED: &[(&CStr, &[&CStr])] = &[
    (
        c"WKWebView",
        &[
            c"_findString:options:maxCount:",
            c"_setFindDelegate:",
            c"_hideFindUI",
            c"_isPlayingAudio",
            c"_webProcessIdentifier",
            c"_inspector",
        ],
    ),
    (c"WKBackForwardList", &[c"_clear"]),
    (
        c"WKUserContentController",
        &[c"_removeAllUserScriptsAssociatedWithContentWorld:"],
    ),
    (c"_WKContentRuleListAction", &[c"blockedLoad"]),
];

/// Callbacks WebKit sends to a delegate that implements them. Only the
/// protocol that declares one can say it still exists. The find callbacks
/// have none registered; the find calls above stand for them.
const DELEGATED: &[(&CStr, &[&CStr])] = &[(
    c"WKNavigationDelegatePrivate",
    &[
        c"_webView:contentRuleListWithIdentifier:performedAction:forURL:",
        c"_webView:contextMenuDidCreateDownload:",
    ],
)];

/// The private selectors this WebKit lacks, as `Owner.selector`. An owner
/// that is itself missing is named alone.
pub fn missing() -> Vec<String> {
    missing_in(IMPLEMENTED, DELEGATED)
}

type Table = [(&'static CStr, &'static [&'static CStr])];

fn missing_in(implemented: &Table, delegated: &Table) -> Vec<String> {
    let mut gone = Vec::new();
    for (class, selectors) in implemented {
        let name = class.to_string_lossy();
        let Some(class) = AnyClass::get(class) else {
            gone.push(name.into_owned());
            continue;
        };
        for selector in *selectors {
            if class.instance_method(Sel::register(selector)).is_none() {
                gone.push(format!("{name}.{}", selector.to_string_lossy()));
            }
        }
    }
    for (protocol, selectors) in delegated {
        let name = protocol.to_string_lossy();
        let Some(protocol) = AnyProtocol::get(protocol) else {
            gone.push(name.into_owned());
            continue;
        };
        for selector in *selectors {
            let sel = Sel::register(selector);
            // SAFETY: a registered protocol and selector; the call reads the
            // protocol's method list and returns a description by value.
            let declared = [Bool::YES, Bool::NO].into_iter().any(|required| {
                unsafe { protocol_getMethodDescription(protocol, sel, required, Bool::YES) }
                    .name
                    .is_some()
            });
            if !declared {
                gone.push(format!("{name}.{}", selector.to_string_lossy()));
            }
        }
    }
    gone
}

#[cfg(test)]
mod tests {
    #[test]
    fn a_selector_or_owner_webkit_lacks_is_named() {
        let missing = super::missing_in(
            &[
                (c"WKWebView", &[c"_hideFindUI", c"_noSuchSelector"]),
                (c"_WKNoSuchClass", &[c"_clear"]),
            ],
            &[
                (
                    c"WKNavigationDelegatePrivate",
                    &[c"_webView:noSuchCallback:"],
                ),
                (c"NoSuchProtocol", &[c"_clear"]),
            ],
        );
        assert_eq!(
            missing,
            [
                "WKWebView._noSuchSelector",
                "_WKNoSuchClass",
                "WKNavigationDelegatePrivate._webView:noSuchCallback:",
                "NoSuchProtocol",
            ]
        );
    }

    #[test]
    fn this_webkit_still_has_every_private_selector() {
        let missing = super::missing();
        assert!(missing.is_empty(), "missing: {missing:?}");
    }
}
