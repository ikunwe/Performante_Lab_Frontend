import { storageCatalogData } from '../core/catalog/storage-catalog';
import { catalogCars, catalogParts } from './catalog.fixture';
export function seedCatalogFixture(extras=false) {
 const civic={id:'ref:honda:civic',brand:'honda',name:'civic',image:'',body:'',reference:{brandId:'honda',modelId:'honda:civic',modelName:'civic',generationId:null,generationName:null,chassisCodes:[],yearStart:null,yearEnd:null,sourceUrl:'https://example.com/car'}};
 const generation={...civic,id:'ref:toyota:corolla:gen',brand:'Toyota',name:'Toyota Corolla',reference:{...civic.reference,brandId:'toyota',modelId:'toyota:corolla',modelName:'Corolla',generationId:'toyota:corolla:gen',generationName:'Corolla Sedan (2022)',yearStart:2022}};
 storageCatalogData.set({schemaVersion:1,source:'storage',fetchedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),
  brands:[{id:'ferrari',name:'Ferrari',slug:'ferrari',aliases:[],logoUrl:'https://example.com/logo.png'},{id:'lamborghini',name:'Lamborghini',slug:'lamborghini',aliases:[],logoUrl:'https://example.com/logo.png'}],
  cars:[...catalogCars,...(extras?[civic,generation]:[])],parts:catalogParts.map(p=>({...p,previewImage:'https://example.com/part.png'}))});
}
