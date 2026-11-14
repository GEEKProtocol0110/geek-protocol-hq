"""Build the publication PDF and exact vector figures from docs/WHITEPAPER.md.
Run with Python containing reportlab and pypdf; pass an output PDF path.
"""
from pathlib import Path
import re, html, sys
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from reportlab.graphics.shapes import Drawing, Rect, Line, Circle, String, Polygon
from reportlab.graphics import renderSVG

ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'public/whitepaper/Geek-Protocol-Whitepaper.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
for name,file in [('Body','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, '/usr/share/fonts/truetype/dejavu/'+file))
INK=HexColor('#153b36'); TEAL=HexColor('#087d72'); PALE=HexColor('#edf5f2'); MUTED=HexColor('#526c66'); NAVY=HexColor('#071b20'); GOLD=HexColor('#e6ba62')
W,H=A4; WIDTH=W-104
body=ParagraphStyle('Body',fontName='Body',fontSize=9.8,leading=15.3,textColor=INK,spaceAfter=10,allowWidows=0,allowOrphans=0)
heading=ParagraphStyle('Heading',parent=body,fontName='Bold',fontSize=18,leading=23,spaceBefore=24,spaceAfter=12,keepWithNext=True)
small=ParagraphStyle('Small',parent=body,fontSize=8.4,leading=12.8,textColor=MUTED)
caption=ParagraphStyle('Caption',parent=small,fontSize=8,leading=11,spaceAfter=14)
refs=ParagraphStyle('Refs',parent=small,spaceAfter=8)
cell=ParagraphStyle('Cell',parent=body,fontSize=8.5,leading=12,spaceAfter=0)
cellhead=ParagraphStyle('Cellhead',parent=cell,fontName='Bold',textColor=white)

def inline(text):
    escaped=html.escape(text)
    return re.sub(r'\[([^\]]+)\]\((https://[^\s)]+)\)',r'<link href="\2" color="#087d72"><u>\1</u></link>',escaped)

def label(d,x,y,text,size=9,color=INK,bold=False):
    d.add(String(x,y,text,fontName='Bold' if bold else 'Body',fontSize=size,fillColor=color,textAnchor='middle'))
def arrow(d,x1,y1,x2,y2):
    d.add(Line(x1,y1,x2,y2,strokeColor=TEAL,strokeWidth=1.4))
    if x1==x2:d.add(Polygon([x2,y2,x2-3,y2+5,x2+3,y2+5],fillColor=TEAL,strokeColor=TEAL))
    else:d.add(Polygon([x2,y2,x2-5,y2-3,x2-5,y2+3],fillColor=TEAL,strokeColor=TEAL))
def box(d,x,y,w,title,detail):
    d.add(Rect(x,y,w,53,rx=6,fillColor=PALE,strokeColor=HexColor('#b6d2c9')))
    label(d,x+w/2,y+32,title,10,bold=True);label(d,x+w/2,y+15,detail,8)

def architecture():
    d=Drawing(WIDTH,233)
    box(d,0,155,140,'Browser','Displays and submits')
    box(d,175,155,140,'HQ API','Authorizes and scores')
    box(d,350,155,WIDTH-350,'Redis','Private app state')
    arrow(d,140,181,175,181);arrow(d,315,181,350,181)
    box(d,0,40,140,'User wallet','User approves signing')
    box(d,175,40,140,'Kaspa network','Wallet transaction')
    box(d,350,40,WIDTH-350,'Indexer','Observed token state')
    arrow(d,140,66,175,66);arrow(d,315,66,350,66)
    d.add(Line(70,93,70,145,strokeColor=MUTED,strokeDashArray=[3,3]));label(d,70,116,'Separate approval',7.5)
    d.add(Line(420,103,245,103,strokeColor=TEAL,strokeWidth=1.2));d.add(Line(420,93,420,103,strokeColor=TEAL));arrow(d,245,103,245,155)
    label(d,332,113,'Status read',8)
    label(d,WIDTH/2,12,'Application records and wallet operations have distinct authority.',8.2)
    return d

def fees():
    d=Drawing(WIDTH,151)
    d.add(Rect(0,105,WIDTH,35,rx=4,fillColor=NAVY,strokeColor=NAVY));label(d,WIDTH/2,118,'ELIGIBLE PLATFORM FEE  /  PROPOSED POLICY',9,white,True)
    arrow(d,WIDTH*.26,105,WIDTH*.26,83);arrow(d,WIDTH*.76,105,WIDTH*.76,83)
    box(d,0,28,WIDTH*.64,'70%  /  Reward funding','Recycle pending: floor(7F / 10)')
    box(d,WIDTH*.67,28,WIDTH*.33,'30%  /  Burn pending','Remainder: F - recycle')
    label(d,WIDTH/2,8,'F is the fee portion. Planned allocations require separate settlement evidence.',8)
    return d
FIGURES={'architecture':architecture(),'fees':fees()}
for key,d in FIGURES.items():renderSVG.drawToFile(d,str(ROOT/f'public/whitepaper/assets/{key}.svg'))

class Paper(SimpleDocTemplate):
    def beforeDocument(self): self.section_number=0
    def afterFlowable(self,f):
        if isinstance(f,Paragraph) and f.style.name=='Heading':
            key='section-'+str(self.section_number);self.section_number+=1
            self.canv.bookmarkPage(key);self.canv.addOutlineEntry(f.getPlainText(),key,level=0)
            self.notify('TOCEntry',(0,f.getPlainText(),self.page,key))

def furniture(c,doc):
    c.saveState()
    if doc.page==1:
        c.setFillColor(NAVY);c.rect(0,0,W,H,fill=1,stroke=0)
        c.setStrokeColor(HexColor('#194349'));c.setLineWidth(.7)
        points=[(390,720),(480,675),(362,626),(477,555),(342,492),(455,419),(365,349)]
        for a,b in zip(points,points[1:]):c.line(*a,*b)
        for x,y in points:c.setFillColor(TEAL);c.circle(x,y,3,fill=1,stroke=0)
        c.setFillColor(GOLD);c.rect(52,H-72,35,3,fill=1,stroke=0)
        c.setFont('Bold',8);c.setFillColor(HexColor('#b2cfc7'));c.drawString(52,H-96,'LEARNING / COMMUNITY / KASPA')
        c.setFillColor(white);c.setFont('Bold',49);c.drawString(48,H-203,'GEEK');c.drawString(48,H-260,'PROTOCOL')
        c.setFillColor(HexColor('#70ded0'));c.setFont('Bold',22);c.drawString(52,H-308,'Proof of Learning on Kaspa')
        c.setFillColor(white);c.setFont('Body',14);c.drawString(52,H-350,'Whitepaper  /  Version 1.0')
        c.setFont('Bold',25);c.drawString(52,274,'Make knowledge useful.')
        c.setFont('Body',11);c.setFillColor(HexColor('#c7dbd5'));c.drawString(52,245,'Learn. Practice. Understand. Return.')
        c.setStrokeColor(TEAL);c.line(52,182,W-52,182)
        c.setFont('Bold',10);c.setFillColor(GOLD);c.drawString(52,153,'ALL HOPE, NO HYPE.')
        c.setFont('Body',9);c.setFillColor(HexColor('#c7dbd5'));c.drawString(52,127,'November 2, 2026  /  Published')
        c.drawString(52,106,'Prepared by Geek Protocol')
    else:
        c.setFont('Bold',8);c.setFillColor(TEAL);c.drawString(52,H-31,'GEEK / PROTOCOL')
        c.setFont('Body',7.5);c.setFillColor(MUTED);c.drawRightString(W-52,H-31,'WHITEPAPER  /  VERSION 1.0')
        c.setStrokeColor(HexColor('#d4e0da'));c.line(52,43,W-52,43)
        c.setFont('Body',7.4);c.setFillColor(MUTED);c.drawString(52,28,'All Hope, No Hype.  |  Published');c.drawRightString(W-52,28,f'{doc.page:02}')
    c.restoreState()

def make_table(rows):
    widths=[WIDTH/len(rows[0])]*len(rows[0])
    if len(rows[0])==2:widths=[WIDTH*.38,WIDTH*.62]
    data=[[Paragraph(inline(v),cellhead if i==0 else cell) for v in row] for i,row in enumerate(rows)]
    t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),INK),('ROWBACKGROUNDS',(0,1),(-1,-1),[PALE,white]),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('LINEBELOW',(0,-1),(-1,-1),.5,HexColor('#bad2c8'))]))
    t.spaceAfter=16
    return t

source=(ROOT/'docs/WHITEPAPER.md').read_text()
story=[Spacer(1,1),PageBreak(),Paragraph('Inside this whitepaper',ParagraphStyle('ContentsTitle',parent=heading,spaceBefore=8)),Paragraph('A learning ecosystem, its technical foundation, and its path to responsible economic activation.',body),Spacer(1,10)]
toc=TableOfContents();toc.levelStyles=[ParagraphStyle('TOC',fontName='Body',fontSize=9.3,leading=14,textColor=INK,spaceBefore=3,leftIndent=0,rightIndent=18)]
story.extend([toc,Spacer(1,22),make_table([['Document control','Edition'],['Version / date','1.0 / November 2, 2026'],['Status','Published; approved by the founder on November 13, 2026'],['Publisher','Geek Protocol'],['Scope','Current Alpha, proposed economy, and release requirements']]),PageBreak()])
for block in source.strip().split('\n\n')[4:]:
    if block.startswith('### '):
        if block.startswith('### 13.'):story.append(PageBreak())
        story.append(Paragraph(inline(block[4:]),heading))
    elif block.startswith('!['):
        match=re.fullmatch(r'!\[([^\]]+)\]\(/whitepaper/assets/([a-z-]+)\.svg\)',block)
        if not match:raise ValueError(block)
        story.append(KeepTogether([FIGURES[match[2]],Paragraph(inline(match[1]),caption)]))
    elif block.startswith('| '):
        rows=[[x.strip() for x in line.split('|')[1:-1]] for line in block.splitlines()]
        story.append(make_table([rows[0]]+rows[2:]))
    elif re.match(r'^\[\d+\] ',block):
        for line in block.splitlines():story.append(Paragraph(inline(line),refs))
    else:story.append(Paragraph(inline(block.replace('\n',' ')),body))
doc=Paper(str(OUT),pagesize=A4,leftMargin=52,rightMargin=52,topMargin=59,bottomMargin=59,title='Geek Protocol | Proof of Learning on Kaspa | Whitepaper v1.0',author='Geek Protocol',subject='Learning architecture, content integrity, token economics, and governance')
doc.multiBuild(story,onFirstPage=furniture,onLaterPages=furniture)
from pypdf import PdfReader
reader=PdfReader(str(OUT));print({'file':str(OUT),'pages':len(reader.pages),'bookmarks':len(reader.outline)})
assert len(reader.outline)==14
assert len(reader.pages[1].extract_text())>300
