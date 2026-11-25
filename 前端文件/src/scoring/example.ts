import {adaptScoreReport} from './report';
/** Independent UI fixture. Deliberately does NOT read Parameters or Simulation. */
export const EXAMPLE_SCORE_REPORT=adaptScoreReport({
 provenance:'example',version:'pdf-ui-fixture-1',completeness:'complete',max_score:100,total_score:88.4,grade:'A',grade_label:'优良（示例评级）',
 warnings:[{id:'unconnected-models',message:'全天日照、沙发暴露与低碳模型尚未联调；以下值仅为独立排版示例，不是当前方案计算。',severity:'notice',item_keys:[]}],
 methodology_note:'固定四维十项示例，供评分布局与空间定位联调。不随滑块或寻优变化，不代表实测、物理精度或规范认证；±10%误差与寻优必达S级均未经验证。',
 dimensions:[
 {id:'summer_shading',name:'夏季遮阳与防过热',weight:35,score:31.2,items:[
 {key:'summer_shading_rate',name:'夏季遮挡率',value_display:'92%（示例）',threshold_display:'≥ 90%满分 / 项目目标≥85%',score:20,max_score:20,status:'pass',citation:'PDF方案示例：解析几何直射遮挡目标',citation_kind:'project'},
 {key:'wwr_shgc',name:'窗墙比与等效SHGC',value_display:'WWR 0.42 / SHGC 0.28（示例）',threshold_display:'WWR≤0.45 且 SHGC≤0.45',score:11.2,max_score:15,status:'pass',citation:'PDF列举GB 55015—2021 / GB 50176—2016，条文适用性待核验',citation_kind:'unspecified'}]},
 {id:'winter_gain',name:'冬季得热与日照',weight:25,score:22.2,items:[
 {key:'winter_solar_gain_rate',name:'冬季得热率',value_display:'74%（示例）',threshold_display:'≥ 80%满分 / 项目目标≥75%',score:10.2,max_score:12,status:'warn',citation:'PDF方案示例：冬季正午透射得热目标',citation_kind:'project'},
 {key:'winter_penetration_m',name:'冬季阳光进深',value_display:'2.72 m（示例）',threshold_display:'≥ 2.8 m满分 / 项目目标≥2.5 m',score:7.5,max_score:8,status:'pass',citation:'PDF方案示例：沙发区正午入射进深',citation_kind:'project',link_target:'winter-depth'},
 {key:'winter_sun_hours',name:'冬至日满窗日照',value_display:'1.9 h（示例，非计算）',threshold_display:'≥ 2 h满分 / ≥1 h参考底线',score:4.5,max_score:5,status:'pass',citation:'PDF参照GB 50180—2018，适用性待后端核验',citation_kind:'reference'}]},
 {id:'daylight',name:'室内自然采光',weight:25,score:22,items:[
 {key:'daylight_compliance_rate',name:'采光达标面积比',value_display:'83%（示例）',threshold_display:'DF≥2%面积：85%满分 / 80%目标',score:13,max_score:15,status:'pass',citation:'PDF参照GB 50033—2013，全阴天DF体系',citation_kind:'reference'},
 {key:'daylight_uniformity',name:'采光均匀度',value_display:'0.38（示例）',threshold_display:'Emin/Eavg ≥ 0.40',score:4.5,max_score:5,status:'warn',citation:'PDF参照GB 50033—2013，地板网格',citation_kind:'reference'},
 {key:'window_floor_ratio',name:'窗地面积比',value_display:'0.16（示例）',threshold_display:'≥ 1/6满分 / ≥1/7参考',score:4.5,max_score:5,status:'pass',citation:'PDF参照GB 50096—2011，适用性待核验',citation_kind:'reference'}]},
 {id:'health_carbon',name:'居住健康与低碳',weight:15,score:13,items:[
 {key:'sofa_exposure_hours',name:'沙发区夏季直射暴露',value_display:'0.9 h/d（示例，非计算）',threshold_display:'≤0.5 h/d满分 / ≤2 h/d参考',score:6,max_score:8,status:'pass',citation:'PDF参照ISO 105-B02；暴露并非褪色实测',citation_kind:'reference',link_target:'sofa'},
 {key:'carbon_reduction',name:'相对节能降碳潜力',value_display:'25%（示例，非碳核算）',threshold_display:'较无遮阳基准降负荷≥25%',score:7,max_score:7,status:'pass',citation:'PDF参照GB/T 51366—2019，简化模型待联调',citation_kind:'reference'}]}
 ]
});
