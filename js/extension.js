(function() {
  'use strict';

  class PagesExtension extends window.Extension {
    constructor() {
      super('pages-extension');
      this.addMenuEntry('Pages Extension');

      if (!window.Extension.prototype.hasOwnProperty('load')) {
        this.load();
      }
    }

    load() {
      this.content = '';
      return fetch(`/extensions/${this.id}/views/content.html`)
        .then((res) => res.text())
        .then((text) => {
          this.content = text;
        })
        .catch((e) => console.error('Failed to fetch content:', e));
    }

    show() {
      this.view.innerHTML = this.content;
      const this_id = this.id;
      const rowtype_mapping = {
        G: 'group',
        group: 'G',
        P: 'page',
        page: 'P',
        T: 'thing',
        thing: 'T',
      };

      // grab references to elements that will be used several times
      const resultsLoc = document
        .getElementById('pagext-dynamic-data');
      const modalBackground = document
        .getElementById('pagext-modal-background');
      const confirmAction = document
        .getElementById('pagext-confirm-action');
      const confirmItem = document
        .getElementById('pagext-confirm-item');
      const confirmText = document
        .getElementById('pagext-confirm-description');
      const inputName = document
        .getElementById('pagext-input-name');
      const currentType = document
        .getElementById('pagext-current-type');
      const currentItem = document
        .getElementById('pagext-current-item');
      const selectionBox = document
        .getElementById('pagext-input-select');
      const acknowledgeMessage = document
        .getElementById('pagext-acknowledge-message');

      // open a modal to hide everything else until the user acts
      const openModal = function(subType) {
        document
          .getElementById('pagext-modal-text')
          .style.display = subType === 'text' ? 'block' : 'none';
        document
          .getElementById('pagext-modal-confirm')
          .style.display = subType === 'confirm' ? 'block' : 'none';
        document
          .getElementById('pagext-modal-select')
          .style.display = subType === 'select' ? 'block' : 'none';
        document
          .getElementById('pagext-modal-acknowledge')
          .style.display = subType === 'acknowledge' ? 'block' : 'none';
        modalBackground.style.display = 'block';
        if (subType === 'text') {
          inputName.focus();
        } else if (subType === 'select') {
          selectionBox.focus();
        } else if (subType === 'confirm') {
          document.getElementById('pagext-button-confirm-cancel').focus();
        } else if (subType === 'acknowledge') {
          document.getElementById('pagext-button-acknowledge').focus();
        }
      };

      // close the modal
      const closeModal = function() {
        modalBackground.style.display = 'none';
        document
          .getElementById('pagext-modal-text')
          .style.display = 'none';
        document
          .getElementById('pagext-modal-confirm')
          .style.display = 'none';
        document
          .getElementById('pagext-modal-select')
          .style.display = 'none';
        document
          .getElementById('pagext-modal-acknowledge')
          .style.display = 'none';
      };

      // used in many places to display lists of pages, of groups, and of their contents
      const list_event_listener = function(itemType, itemNo) {
        currentType.value = itemType;
        if (itemNo === null) {
          currentItem.value = '';
        } else if (itemNo && itemNo > 0) {
          currentItem.value = parseInt(itemNo);
          if (currentItem.value === 'Nan' || currentItem.value < 1) {
            currentItem.value = '';
          }
        } else {
          currentItem.value = '';
        }
        let kv = {};
        let linkType = itemType;
        if (itemNo && itemNo > 0) {
          kv = {item: parseInt(itemNo)};
          if (itemType == 'group') {
            linkType = 'thing';
          } else if (itemType == 'page') {
            linkType = 'group';
          }
        }
        window.API.postJson(
          `/extensions/${this_id}/api/${itemType}`, kv
        ).then((body) => {
          if (!Array.isArray(body)) {
            throw new Error(`expected an Array, received ${JSON.stringify(body)}`);
          }
          const h2 = document.createElement('h2');
          const ul = document.createElement('ul');
          while (resultsLoc.firstChild) {
            resultsLoc.removeChild(resultsLoc.firstChild);
          }
          resultsLoc.textContent = '';
          body.forEach(function(item) {
            if (item.rowid == itemNo) { // loose comparison is deliberate, do not change to ===
              h2.textContent = `${itemType}: ${item.name}`;
            } else {
              const li = ul.appendChild(document.createElement('li'));
              if (item.link_rowid && item.link_rowid > 0) {
                li.setAttribute('draggable', 'true');
              }
              if (item.rowtype === 'T') {
                li.appendChild(document.createElement('span')).textContent = item.name;
              } else {
                const a = li.appendChild(document.createElement('a'));
                a.setAttribute('id', `pagext/item/${linkType}_${item.rowid}`);
                a.textContent = item.name;
                li.appendChild(document.createTextNode(' '));
                const b1 = li.appendChild(document.createElement('button'));
                b1.textContent = '\u00A0';
                b1.setAttribute('id', `pagext/edit/${linkType}_${item.rowid}`);
                b1.setAttribute('class', 'pagext-button-edit');
              }
              li.appendChild(document.createTextNode(' '));
              const b2 = li.appendChild(document.createElement('button'));
              b2.textContent = '\u00A0';
              if (item.link_rowid && item.link_rowid > 0) {
                b2.setAttribute('id', `pagext/delete_link/${item.link_rowid}`);
              } else {
                b2.setAttribute('id', `pagext/delete/${linkType}_${item.rowid}`);
              }
              b2.setAttribute('class', 'pagext-button-delete');
            }
          });
          if (h2.textContent === '') {
            if (itemType === 'group') {
              h2.textContent = 'Groups';
            } else {
              h2.textContent = 'Pages';
            }
          }
          resultsLoc.appendChild(h2);
          if (ul.firstChild) {
            resultsLoc.appendChild(ul);
          } else {
            const p = document.createElement('p');
            p.textContent = ` - no ${itemType === 'group' ? 'members' : 'contents'} available -`;
            resultsLoc.appendChild(p);
          }
        }).catch((e) => {
          console.error('pagext/extension.js ', e.toString());
          while (resultsLoc.firstChild) {
            resultsLoc.removeChild(resultsLoc.firstChild);
          }
          resultsLoc.textContent = `Error: ${e.toString()}`;
        });
      };

      // process text input on a modal
      const procesInputName = function() {
        if (inputName.value.length > 0) {
          window.API.postJson(
            `/extensions/${this_id}/api/${currentType.value}/add`, {name: inputName.value}
          ).then(() => {
            list_event_listener(currentType.value, currentItem.value);
          }).catch((e) => {
            console.error('pagext/extension.js ', e.toString());
            while (resultsLoc.firstChild) {
              resultsLoc.removeChild(resultsLoc.firstChild);
            }
            resultsLoc.textContent = `Error: ${e.toString()}`;
          });
        }
      };

      // filter events on the results area for clicks on any <a> anchors.
      // On click, go to the linked item
      resultsLoc.addEventListener('click', (event) => {
        if (event.target.nodeName == 'A' &&
                    event.target.id &&
                    event.target.id.startsWith('pagext/item/')) {
          const _x = event.target.id.substr(12).split('_'); // 12 = length of pagext/item/
          // todo should open the page for display
          // list_event_listener(x[0], x[1]);
        }
      });

      // filter events on the results area for clicks on the bin buttons
      // On click, request confirmation of the delete, the actual deletion done after comfirm
      resultsLoc.addEventListener('click', (event) => {
        if (event.target.nodeName == 'BUTTON' && event.target.id) {
          if (event.target.id.startsWith('pagext/edit/')) {
            const x = event.target.id.substr(12).split('_'); // 12 = length of pagext/edit/
            list_event_listener(x[0], x[1]);
          } else if (event.target.id.startsWith('pagext/delete/')) {
            const x = event.target.id.substr(14).split('_'); // 14 = length of pagext/delete/
            confirmAction.value = `${x[0]}/delete`;
            confirmItem.value = x[1];
            confirmText.textContent =
`delete "${event.target.parentElement.firstElementChild.textContent}"?`;
            openModal('confirm');
          } else if (event.target.id.startsWith('pagext/delete_link/')) {
            confirmItem.value = event.target.id.substr(19); // 19 = length of pagext/delete_link
            confirmAction.value = 'delete_link';
            confirmText.textContent =
`delete link to "${event.target.parentElement.firstElementChild.textContent}"?`;
            openModal('confirm');
          }
        }
      });

      // clicking on the background hides the modal and terminates the modal process
      modalBackground.addEventListener('click', (event) => {
        if (event.target === modalBackground) {
          closeModal();
        }
      });

      // listen for Enter in a text input modal and process the results
      // escape exits
      inputName.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          closeModal();
          procesInputName();
        } else if (event.key === 'Escape') {
          closeModal();
        }
      });

      // click listener on the main Groups button to display the main list
      document
        .getElementById('pagext-button-groups')
        .addEventListener('click', () => list_event_listener('group'));

      // click listener on the main Pages button to display the main list
      document
        .getElementById('pagext-button-pages')
        .addEventListener('click', () => list_event_listener('page'));

      // click listener for the add button
      // initiates a modal (text or select) to add groups, pages or links
      document
        .getElementById('pagext-button-add')
        .addEventListener('click', () => {
          if (currentItem.value === '' || parseInt(currentItem.value) < 1) {
            inputName.value = '';
            openModal('text');
          } else if (currentType.value == 'page' || currentType.value == 'group') {
            window.API.postJson(`/extensions/${this_id}/api/${currentType.value}/listavailable`,
                                {item: parseInt(currentItem.value)}
            ).then((body) => {
              if (!Array.isArray(body)) {
                throw new Error(`expected an Array, received ${JSON.stringify(body)}`);
              }
              while (selectionBox.firstChild) {
                selectionBox.remove(selectionBox.firstChild);
              }
              body.forEach(function(item) {
                const option = selectionBox.appendChild(document.createElement('option'));
                option.setAttribute('value', item.rowid);
                option.textContent = `${rowtype_mapping[item.rowtype]}: ${item.name}`;
              });
              if (selectionBox.firstChild) {
                openModal('select');
              } else {
                acknowledgeMessage.textContent = 'nothing available to add';
                openModal('acknowledge');
              }
            }).catch((e) => {
              console.error('pagext/extension.js ', e.toString());
              while (resultsLoc.firstChild) {
                resultsLoc.removeChild(resultsLoc.firstChild);
              }
              resultsLoc.textContent = `Error: ${e.toString()}`;
            });
          }
        });

      // click listener for the confirm button on the text modal
      document.getElementById('pagext-button-input-confirm')
        .addEventListener('click', () => {
          closeModal();
          procesInputName();
        });

      // click listener for the cancel button on the text modal
      document.getElementById('pagext-button-input-cancel')
        .addEventListener('click', () => closeModal());

      // click listener for the confirm button on the confirmation modal
      document.getElementById('pagext-button-confirm-do')
        .addEventListener('click', () => {
          closeModal();
          window.API.postJson(`/extensions/${this_id}/api/${confirmAction.value}`,
                              {item: confirmItem.value}
          ).then(() => {
            list_event_listener(currentType.value, currentItem.value);
          }).catch((e) => {
            console.error('pagext/extension.js', e.toString());
            while (resultsLoc.firstChild) {
              resultsLoc.removeChild(resultsLoc.firstChild);
            }
            resultsLoc.textContent = `Error: ${e.toString()}`;
          });
        });

      // click listener for the cancel button on the confirmation modal
      document.getElementById('pagext-button-confirm-cancel')
        .addEventListener('click', () => closeModal());

      // listens for the Enter or Escape key on the confirmation modal
      // cancel the action
      document.getElementById('pagext-modal-confirm')
        .addEventListener('keyup', (event) => {
          if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault();
            closeModal();
          }
        });

      // handle clicking the confirm button or Enter on the select modal
      const selectConfirm = () => {
        closeModal();
        if (selectionBox.value > 0) {
          window.API.postJson(
            `/extensions/${this_id}/api/${currentType.value}/insert`, {
              container: currentItem.value,
              contained: selectionBox.value,
              link_order: 999999,
            }
          ).then(() => {
            list_event_listener(currentType.value, currentItem.value);
          }).catch((e) => {
            console.error('pagext/extension.js', e.toString());
            while (resultsLoc.firstChild) {
              resultsLoc.removeChild(resultsLoc.firstChild);
            }
            resultsLoc.textContent = `Error: ${e.toString()}`;
          });
        }
      };

      // click listener for the confirm button on the selection modal
      document.getElementById('pagext-button-select-confirm')
        .addEventListener('click', selectConfirm);

      // click listener for the Enter key on the selection modal
      document.getElementById('pagext-modal-select')
        .addEventListener('keyup', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            selectConfirm();
          } else if (event.key === 'Escape') {
            closeModal();
          }
        });

      // click listener for the cancel button on the selection modal
      document.getElementById('pagext-button-select-cancel')
        .addEventListener('click', () => closeModal());

      // click listener for the OK button on the acknowledge modal
      document.getElementById('pagext-button-acknowledge')
        .addEventListener('click', () => closeModal());

      // listens for the Enter key on the confirmation modal
      // cancel the action
      document.getElementById('pagext-modal-acknowledge')
        .addEventListener('keyup', (event) => {
          if (event.key === 'Enter' || event.key === 'Escape') {
            event.preventDefault();
            closeModal();
          }
        });

      // drag and drop handling
      let dragging = null;
      let dragging_parent = null;
      resultsLoc.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', event.target.id);
        event.dataTransfer.effectAllowed = 'move';
        dragging = event.target;
        dragging_parent = dragging.parentNode;
      });
      resultsLoc.addEventListener('dragover', (event) => {
        if (event.target !== dragging &&
                    (event.target.parentNode === dragging_parent ||
                        event.target.parentNode.parentNode === dragging_parent)) {
          event.preventDefault();
        }
      });
      resultsLoc.addEventListener('dragenter', (event) => {
        if (event.target !== dragging &&
                    (event.target.parentNode === dragging_parent ||
                        event.target.parentNode.parentNode === dragging_parent)) {
          event.preventDefault();
        }
      });
      resultsLoc.addEventListener('drop', (event) => {
        let realTarget = null;
        if (event.target.parentNode === dragging_parent) {
          realTarget = event.target;
        } else if (event.target.parentNode.parentNode === dragging_parent) {
          realTarget = event.target.parentNode;
        }
        if (realTarget && realTarget !== dragging) {
          if (Array.prototype.indexOf.call(dragging_parent.children, dragging) >
                        Array.prototype.indexOf.call(dragging_parent.children, realTarget)) {
            // if dragging from below the target, insert before the target
            dragging_parent.insertBefore(dragging, realTarget);
          } else {
            // if dragging from above the target, insert after the target
            dragging_parent.insertBefore(dragging, realTarget.nextSibling);
          }
          const kv = {};
          dragging_parent.children.forEach((item, index) => {
            kv[item.children[item.children.length - 1].id.split('/').pop()] = index;
          });
          window.API.postJson(
            `/extensions/${this_id}/api/update_link_order`, kv);
        }
      });
    }
  }

  new PagesExtension();
})();
