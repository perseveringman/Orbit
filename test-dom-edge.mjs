import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.DOMParser = dom.window.DOMParser;
global.NodeFilter = dom.window.NodeFilter;

// Test stripLeadingTimestampFromElement with edge cases
const LEADING_TIMESTAMP_PREFIX_RE = /^\s*(?:[-*•]\s*)?(?:\[(\d{1,2}[:：]\d{2}(?:[:：]\d{2})?)\]|(\d{1,2}[:：]\d{2}(?:[:：]\d{2})?))(?:\s*[-–—:：]\s*|\s+)?/;

function stripLeadingTimestampFromElement(el) {
  const doc = el.ownerDocument;
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let firstTextNode = null;
  while (walker.nextNode()) {
    const current = walker.currentNode;
    if ((current.nodeValue ?? '').trim().length === 0) continue;
    firstTextNode = current;
    break;
  }
  if (!firstTextNode) return;
  firstTextNode.nodeValue = (firstTextNode.nodeValue ?? '').replace(LEADING_TIMESTAMP_PREFIX_RE, '');
}

// Test case: element with no text nodes
const parser = new DOMParser();
const doc1 = parser.parseFromString('<p></p>', 'text/html');
const p1 = doc1.querySelector('p');
stripLeadingTimestampFromElement(p1);
console.log('Empty element:', p1.innerHTML);

// Test case: element with only whitespace
const doc2 = parser.parseFromString('<p>   </p>', 'text/html');
const p2 = doc2.querySelector('p');
stripLeadingTimestampFromElement(p2);
console.log('Whitespace element:', p2.innerHTML);

// Test case: element with nested structure
const doc3 = parser.parseFromString('<p><strong>00:30</strong> Content</p>', 'text/html');
const p3 = doc3.querySelector('p');
stripLeadingTimestampFromElement(p3);
console.log('Nested timestamp:', p3.innerHTML);

// Test case: multiple text nodes before timestamp
const doc4 = parser.parseFromString('<p>  <span></span>  00:30 Content</p>', 'text/html');
const p4 = doc4.querySelector('p');
stripLeadingTimestampFromElement(p4);
console.log('Multiple text nodes:', p4.innerHTML);
