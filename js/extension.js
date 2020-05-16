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
                    kv = { item: parseInt(itemNo) };
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
                        throw new Error(`unexpected result - expected an Array, received ${JSON.stringify(body)}`);
                    }
                    let result = '';
                    let first = true;
                    let heading = false;
                    body.forEach(function(item) {
                        if (item.rowid == itemNo) { // loose comparison is deliberate, do not change to ===
                            result = `<h2>${itemType}: ${item.name}</h2>${result}`;
                            heading = true;
                        } else {
                            if (first) {
                                result = `${result}<ul>`;
                                first = false;
                            }
                            let deleteOp = `delete/${linkType}_${item.rowid}`;
                            if (item.link_rowid && item.link_rowid > 0) {
                                deleteOp = `delete_link/${item.link_rowid}`;
                            }
                            result =
                                `${result}
<li draggable='true'>
<a id='pagext/item/${linkType}_${item.rowid}'>${item.name}</a>
<button id="pagext/${deleteOp}" class="pagext-button-delete">&nbsp;</button>
</li>`;
                        }
                    });
                    if (!heading) {
                        result = `<h2>${itemType === 'group' ? 'Groups' : 'Pages'}</h2>${result}`;
                    }
                    if (!first) {
                        result = `${result}</ul>`;
                    } else {
                        result = `${result}<p> - no ${itemType === 'group' ? 'members' : 'contents'} available -</p>`;
                    }
                    resultsLoc.innerHTML = result;
                }).catch((e) => {
                    console.error('pagext/extension.js ', e.toString());
                    resultsLoc.innerText = e.toString();
                });
            };

            // used in two places to add an item or link
            const procesInputName = function() {
                if (inputName.value.length > 0) {
                    window.API.postJson(
                        `/extensions/${this_id}/api/${currentType.value}/add`, { name: inputName.value }
                    ).then((body) => {
                        list_event_listener(currentType.value, currentItem.value);
                    }).catch((e) => {
                        console.error('pagext/extension.js ', e.toString());
                        resultsLoc.innerText = e.toString();
                    });
                }
            };

            // filter events on the results area for clicks on any <a> anchors. 
            // On click, go to the linked item
            resultsLoc.addEventListener('click', (event) => {
                if (event.target.nodeName == 'A' &&
                    event.target.id &&
                    event.target.id.startsWith('pagext/item/')) {
                    let x = event.target.id.substr(12).split('_'); // 12 = length of pagext/item/
                    list_event_listener(x[0], x[1]);
                }
            });

            // filter events on the results area for clicks on the bin buttons 
            // On click, request confirmation of the delete, the actual deletion done after comfirm
            resultsLoc.addEventListener('click', (event) => {
                if (event.target.nodeName == 'BUTTON' &&
                    event.target.id) {
                    if (event.target.id.startsWith('pagext/delete/')) {
                        let x = event.target.id.substr(14).split('_'); // 14 = length of pagext/delete/
                        confirmAction.value = `${x[0]}/delete`;
                        confirmItem.value = x[1];
                        confirmText.innerText = `delete "${event.target.previousElementSibling.innerText}"?`;
                    } else if (event.target.id.startsWith('pagext/delete_link/')) {
                        confirmItem.value = event.target.id.substr(19); // 19 = length of pagext/delete_link
                        confirmAction.value = `/delete_link`;
                        confirmText.innerText = `delete link to "${event.target.previousElementSibling.innerText}"?`;
                    } else {
                        return;
                    }
                    openModal('confirm');
                    document.getElementById('pagext-button-confirm-cancel').focus();
                }
            });

            // drag and drop handling
            let dragging = null;
            resultsLoc.addEventListener('dragstart', (event) => {
                event.dataTransfer.setData("text/plain", event.target.id);
                event.dataTransfer.effectAllowed = "move";
                dragging = event.target;
            });
            resultsLoc.addEventListener('dragover', (event) => {
                if (event.target.parentNode === dragging.parentNode || event.target.parentNode.parentNode === dragging.parentNode) {
                    event.preventDefault();
                }
            });
            resultsLoc.addEventListener('dragenter', (event) => {
                if (event.target.parentNode === dragging.parentNode || event.target.parentNode.parentNode === dragging.parentNode) {
                    event.preventDefault();
                }
            });
            resultsLoc.addEventListener('drop', (event) => {
                let parent = dragging.parentNode;
                let realTarget = null;
                if (event.target.parentNode === parent) {
                    realTarget = event.target;
                } else if (event.target.parentNode.parentNode === parent) {
                    realTarget = event.target.parentNode;
                }
                if (realTarget && realTarget !== dragging) {
                    parent.insertBefore(dragging, realTarget);
                    // hack the DOM to make forEach usuable
                    if (!NodeList.prototype.forEach) { NodeList.prototype.forEach = Array.prototype.forEach; }
                    let newList = [];
                    parent.children.forEach((item, index) => {
                        let x = item.firstChild.id;
                        console.log(x);
                        newList.push({ rowid: x, link_order: index });
                    });
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
                        inputName.focus();
                    } else if (currentType.value == 'page' || currentType.value == 'group') {
                        window.API.postJson(
                            `/extensions/${this_id}/api/${currentType.value}/listavailable`, { item: parseInt(currentItem.value) }
                        ).then((body) => {
                            if (!Array.isArray(body)) {
                                throw new Error(`unexpected result - expected an Array, received ${JSON.stringify(body)}`);
                            }
                            let optionHTML = '';
                            body.forEach(function(item) {
                                optionHTML = `${optionHTML}<option value="${item.rowid}">${item.name}</option>`;
                            });
                            selectionBox.innerHTML = optionHTML;
                            if (optionHTML.length > 0) {
                                openModal('select');
                                selectionBox.focus();
                            } else {
                                acknowledgeMessage.innerText = 'nothing available to add';
                                openModal('acknowledge');
                                document.getElementById('pagext-button-acknowledge').focus();
                            }
                        }).catch((e) => {
                            console.error('pagext/extension.js ', e.toString());
                            resultsLoc.innerText = e.toString();
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
                    window.API.postJson(
                        `/extensions/${this_id}/api/${confirmAction.value}`, { item: confirmItem.value }
                    ).then((body) => {
                        list_event_listener(currentType.value, currentItem.value);
                    }).catch((e) => {
                        console.error('pagext/extension.js', e.toString());
                        resultsLoc.innerText = e.toString();
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
                            contained: selectionBox.value
                        }
                    ).then((body) => {
                        list_event_listener(currentType.value, currentItem.value);
                    }).catch((e) => {
                        console.error('pagext/extension.js', e.toString());
                        resultsLoc.innerText = e.toString();
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


        }
    }

    new PagesExtension();
})();