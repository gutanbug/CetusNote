// 에디터 견본 문서: 모든 블록과 서식을 담는다. ED-Editor 스토리와 Debug Playground가 함께 쓴다.
export const SAMPLE_DOC = `
<h1>에디터 문법 한눈에 보기</h1>
<p>이 페이지는 Cetus Note에서 쓸 수 있는 <strong>모든 블록과 서식</strong>을 담고 있다. 직접 고쳐 보자.</p>
<div data-type="callout" data-emoji="💡" data-color="blue"><p>빈 줄에서 <code>#</code>, <code>-</code>, <code>[ ]</code>, <code>&gt;</code>, <code>&gt;&gt;</code>, <code>:::</code>, <code>\`\`\`</code>, <code>---</code> 를 입력하면 블록으로 바뀐다.</p></div>
<h2>목록</h2>
<ul><li><p>글머리 목록</p><ul><li><p>중첩</p></li></ul></li></ul>
<ol><li><p>번호 목록</p></li><li><p>두 번째</p></li></ol>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>끝낸 일</p></li><li data-type="taskItem" data-checked="false"><p>남은 일</p></li></ul>
<h2>블록</h2>
<blockquote><p>인용문은 왼쪽 선으로 구분한다.</p></blockquote>
<details open><summary>토글 제목</summary><div data-type="detailsContent"><p>접을 수 있는 내용</p></div></details>
<hr>
<pre><code class="language-typescript">const greet = (name: string) =&gt; \`안녕, \${name}\`;
</code></pre>
<table><tbody><tr><th><p>단축 입력</p></th><th><p>결과</p></th></tr><tr><td><p><code>$x^2$</code></p></td><td><p>인라인 수식</p></td></tr><tr><td><p><code>:smile:</code></p></td><td><p>이모지</p></td></tr></tbody></table>
<h2>수식</h2>
<p>오일러 항등식 <span data-type="inline-math" data-latex="e^{i\\pi} + 1 = 0"></span></p>
<div data-type="block-math" data-latex="\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}"></div>
<h3>서식</h3>
<p><strong>굵게</strong> <em>기울임</em> <u>밑줄</u> <s>취소선</s> <code>코드</code> <mark>하이라이트</mark> <a href="https://tiptap.dev">링크</a> x<sup>2</sup> H<sub>2</sub>O</p>
<p></p>
`;
