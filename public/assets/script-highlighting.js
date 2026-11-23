'use strict';

const scriptKeywords = {
    sql: 'select distinct from where and or not null is as order by asc desc group having limit offset join inner left right full outer cross on union all insert into values update set delete create alter drop table database index view if exists primary foreign key references default case when then else end between in like ilike exists with recursive over partition returning truncate replace explain use show describe begin commit rollback',
    bash: 'if then else elif fi for while do done in case esac function select until time export local readonly declare return exit source',
    powershell: 'if else elseif switch foreach for while do until function filter param begin process end return break continue throw try catch finally in',
    python: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield true false none',
    javascript: 'async await break case catch class const continue debugger default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield',
    typescript: 'abstract any as async await boolean break case catch class const continue declare default delete do else enum export extends false finally for from function if implements import in infer instanceof interface is keyof let namespace never new null number of private protected public readonly return static string super switch symbol this throw true try type typeof undefined unknown var void while yield',
    php: 'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty endfor endforeach endif endwhile eval exit extends false final finally fn for foreach function global if implements include include_once instanceof interface isset list match namespace new null or print private protected public readonly require require_once return static switch throw trait true try unset use var while xor yield',
    kotlin: 'abstract actual annotation as break by catch class companion const constructor continue crossinline data delegate do dynamic else enum expect external false field file final finally for fun get if import in infix init inline inner interface internal is lateinit noinline null object open operator out override package param private property protected public receiver reified return sealed set setparam super suspend tailrec this throw true try typealias typeof val value var vararg when where while',
    json: 'true false null',
};
const scriptKeywordSets = Object.fromEntries(Object.entries(scriptKeywords).map(([language, words]) => [language, new Set(words.split(' '))]));
const scriptTypes = new Set('char varchar text int integer bigint decimal numeric float double boolean bool date datetime timestamp string number void array map list set'.split(' '));
const scriptTokenColors = {
    keyword: 'text-violet-300',
    string: 'text-orange-300',
    number: 'text-green-300',
    comment: 'text-slate-400 italic',
    function: 'text-amber-200',
    variable: 'text-sky-300',
    property: 'text-sky-300',
    type: 'text-teal-300',
    operator: 'text-pink-300',
};

function highlightScript(code, language) {
    const keywords = scriptKeywordSets[language];
    if (!keywords) return escapeHtml(code);
    let comments = String.raw`//[^\r\n]*|/\*[\s\S]*?(?:\*/|$)`;
    if (language === 'sql') comments = String.raw`--[^\r\n]*|#[^\r\n]*|/\*[\s\S]*?(?:\*/|$)`;
    if (['bash', 'python'].includes(language)) comments = String.raw`#[^\r\n]*`;
    if (language === 'powershell') comments = String.raw`<#[\s\S]*?(?:#>|$)|#[^\r\n]*`;
    if (language === 'php') comments += String.raw`|#[^\r\n]*`;
    if (language === 'json') comments = '(?!)';
    const strings = String.raw`"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|'(?:\\[\s\S]|''|[^'\\])*'|"(?:\\[\s\S]|""|[^"\\])*"|\x60(?:\\[\s\S]|[^\x60\\])*\x60`;
    const tokens = new RegExp(
        `(?<comment>${comments})|(?<string>${strings})`
        + String.raw`|(?<variable>\$\{[^}\r\n]*\}|\$[a-zA-Z_][\w]*|\$[?@#0-9])`
        + String.raw`|(?<number>\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b)`
        + String.raw`|(?<word>\b[a-zA-Z_][\w]*\b)|(?<operator>[+*/%=<>!|&?:~-]+)`,
        'g',
    );
    let html = '';
    let position = 0;
    for (const match of code.matchAll(tokens)) {
        html += escapeHtml(code.slice(position, match.index));
        const value = match[0];
        const groups = match.groups;
        const next = code.slice(match.index + value.length, match.index + value.length + 80);
        let type = '';
        if (groups.comment) type = 'comment';
        else if (groups.string) type = language === 'json' && /^\s*:/.test(next) ? 'property' : 'string';
        else if (groups.variable) type = 'variable';
        else if (groups.number) type = 'number';
        else if (groups.operator) type = 'operator';
        else if (keywords.has(value.toLowerCase())) type = 'keyword';
        else if (/^\s*\(/.test(next)) type = 'function';
        else if (scriptTypes.has(value.toLowerCase())) type = 'type';
        html += type ? `<span class="${scriptTokenColors[type]}">${escapeHtml(value)}</span>` : escapeHtml(value);
        position = match.index + value.length;
    }
    return html + escapeHtml(code.slice(position));
}

function syncScriptHighlightScroll() {
    const input = $('#script-code');
    const preview = $('#script-code-highlight');
    preview.scrollTop = input.scrollTop;
    preview.scrollLeft = input.scrollLeft;
}

function renderScriptHighlight() {
    $('#script-code-highlight code').innerHTML = highlightScript($('#script-code').value, $('#script-language').value) + '\n';
    syncScriptHighlightScroll();
}
